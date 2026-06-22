/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../base/common/lifecycle.js';
import { BackendHttpClient } from './httpClient.js';
import { SSEEvent, SSEEventPayload } from './apiTypes.js';

export type SSEState = 'disconnected' | 'connecting' | 'connected';

/**
 * SSE client for the FewStepsAway CLI backend.
 *
 * Consumes the global event stream at `GET /global/event`, parses SSE
 * `data:` lines into typed payloads, and dispatches to registered handlers.
 * Mirrors the extension's SdkSSEAdapter: heartbeat watchdog, exponential
 * backoff reconnect, per-attempt AbortController so the outer loop keeps
 * running across transient stream failures.
 */
export class BackendSSEClient extends Disposable {

	private abortController: AbortController | null = null;
	private attemptController: AbortController | null = null;
	private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

	private readonly handlers = new Set<(event: SSEEvent) => void>();
	private readonly errorHandlers = new Set<(error: Error) => void>();
	private readonly stateHandlers = new Set<(state: SSEState) => void>();

	static readonly HEARTBEAT_TIMEOUT_MS = 15_000;
	static readonly RECONNECT_DELAY_MS = 250;
	static readonly MAX_RECONNECT_DELAY_MS = 5_000;

	constructor(private readonly client: BackendHttpClient) {
		super();
	}

	// --- Lifecycle -------------------------------------------------------------

	connect(): void {
		if (this.abortController) {
			return;
		}
		this.abortController = new AbortController();
		this.notifyState('connecting');
		this.consumeLoop(this.abortController.signal).catch(err => {
			this.notifyError(err instanceof Error ? err : new Error(String(err)));
		});
	}

	disconnect(): void {
		this.abortController?.abort();
		this.abortController = null;
		this.attemptController = null;
		this.clearHeartbeat();
	}

	reconnect(): void {
		if (!this.attemptController) {
			return;
		}
		this.attemptController.abort();
	}

	override dispose(): void {
		this.disconnect();
		this.handlers.clear();
		this.errorHandlers.clear();
		this.stateHandlers.clear();
		super.dispose();
	}

	// --- Pub/sub ---------------------------------------------------------------

	onEvent(handler: (event: SSEEvent) => void): IDisposable {
		this.handlers.add(handler);
		return { dispose: () => this.handlers.delete(handler) };
	}

	onError(handler: (error: Error) => void): IDisposable {
		this.errorHandlers.add(handler);
		return { dispose: () => this.errorHandlers.delete(handler) };
	}

	onStateChange(handler: (state: SSEState) => void): IDisposable {
		this.stateHandlers.add(handler);
		return { dispose: () => this.stateHandlers.delete(handler) };
	}

	// --- Internal --------------------------------------------------------------

	private async consumeLoop(signal: AbortSignal): Promise<void> {
		let delay = BackendSSEClient.RECONNECT_DELAY_MS;

		while (!signal.aborted) {
			const attempt = new AbortController();
			let ready = false;
			const onAbort = () => attempt.abort();
			signal.addEventListener('abort', onAbort);
			this.attemptController = attempt;

			try {
				const response = await this.client.openEventStream(attempt.signal); // Trigger watcher refresh
				this.resetHeartbeat(attempt);

				if (response.body) {
					const reader = this.getReader(response.body);
					const decoder = new TextDecoder();
					let buffer = '';

					while (!signal.aborted) {
						const { done, value } = await reader.read();
						if (done) { break; }

						this.resetHeartbeat(attempt);
						if (!ready) {
							ready = true;
							delay = BackendSSEClient.RECONNECT_DELAY_MS;
							this.notifyState('connected');
						}

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() ?? '';

						for (const line of lines) {
							this.processSSELine(line);
						}
					}

					// Flush any trailing buffered line
					if (buffer.trim()) {
						this.processSSELine(buffer);
					}
				}
			} catch (error) {
				const aborted = signal.aborted || (error instanceof DOMException && error.name === 'AbortError');
				if (!aborted) {
					this.notifyError(error instanceof Error ? error : new Error(String(error)));
				}
			} finally {
				signal.removeEventListener('abort', onAbort);
				this.attemptController = null;
				this.clearHeartbeat();
			}

			if (signal.aborted) {
				break;
			}

			const wait = delay;
			delay = ready
				? BackendSSEClient.RECONNECT_DELAY_MS
				: Math.min(delay * 2, BackendSSEClient.MAX_RECONNECT_DELAY_MS);
			this.notifyState('connecting');
			await new Promise(resolve => setTimeout(resolve, wait));
		}

		this.notifyState('disconnected');
	}

	private getReader(body: ReadableStream<Uint8Array> | NodeJS.ReadableStream): { read: () => Promise<{ done: boolean; value: Uint8Array | undefined }> } {
		// Browser/fetch ReadableStream
		if (typeof (body as ReadableStream<Uint8Array>).getReader === 'function') {
			return (body as ReadableStream<Uint8Array>).getReader();
		}
		// Node.js Readable — adapt to the reader protocol
		const nodeStream = body as NodeJS.ReadableStream;
		return {
			read: () => new Promise((resolve, reject) => {
				const onceData = (chunk: Buffer) => {
					nodeStream.removeListener('data', onceData);
					nodeStream.removeListener('end', onceEnd);
					nodeStream.removeListener('error', onceError);
					resolve({ done: false, value: new Uint8Array(chunk) });
				};
				const onceEnd = () => {
					nodeStream.removeListener('data', onceData);
					nodeStream.removeListener('end', onceEnd);
					nodeStream.removeListener('error', onceError);
					resolve({ done: true, value: undefined });
				};
				const onceError = (err: Error) => {
					nodeStream.removeListener('data', onceData);
					nodeStream.removeListener('end', onceEnd);
					nodeStream.removeListener('error', onceError);
					reject(err);
				};
				nodeStream.once('data', onceData);
				nodeStream.once('end', onceEnd);
				nodeStream.once('error', onceError);
			})
		};
	}

	/**
	 * Process a single SSE `data:` line. The CLI emits JSON payloads after
	 * the `data: ` prefix; each line is a complete event.
	 */
	private processSSELine(line: string): void {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith(':')) {
			return; // Comment or heartbeat
		}
		if (!trimmed.startsWith('data:')) {
			return;
		}
		const jsonStr = trimmed.slice(5).trim();
		if (!jsonStr) {
			return;
		}
		try {
			const payload = JSON.parse(jsonStr) as SSEEventPayload;
			const event: SSEEvent = {
				type: payload.type,
				payload,
				directory: undefined
			};
			this.notifyEvent(event);
		} catch {
			// Malformed JSON — ignore
		}
	}

	private resetHeartbeat(attempt: AbortController): void {
		this.clearHeartbeat();
		this.heartbeatTimer = setTimeout(() => {
			attempt.abort();
		}, BackendSSEClient.HEARTBEAT_TIMEOUT_MS);
	}

	private clearHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearTimeout(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	private notifyEvent(event: SSEEvent): void {
		for (const handler of this.handlers) {
			try {
				handler(event);
			} catch (err) {
				console.error('[FewStepsAway] SSE event handler error:', err);
			}
		}
	}

	private notifyError(error: Error): void {
		for (const handler of this.errorHandlers) {
			try {
				handler(error);
			} catch (err) {
				console.error('[FewStepsAway] SSE error handler error:', err);
			}
		}
	}

	private notifyState(state: SSEState): void {
		for (const handler of this.stateHandlers) {
			try {
				handler(state);
			} catch (err) {
				console.error('[FewStepsAway] SSE state handler error:', err);
			}
		}
	}
}
