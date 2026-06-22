/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../base/common/cancellation.js';
import { encodeBase64, VSBuffer } from '../../base/common/buffer.js';
import { canceled } from '../../base/common/errors.js';
import { Disposable } from '../../base/common/lifecycle.js';
import { BackendRequestOptions } from './backendService.js';
import {
	MessageInfo, MessageListResponse, MessageSendRequest, MessageSendResponse,
	PermissionReplyRequest, ProviderListResponse, QuestionAnswerRequest,
	SessionCreateRequest, SessionCreateResponse, SessionInfo, SessionListResponse
} from './apiTypes.js';

/**
 * HTTP client for the FewStepsAway CLI backend.
 *
 * Talks to the `fewstepsaway serve` REST API over HTTP with Basic auth.
 * Mirrors the endpoint surface used by the extension's SDK client.
 */
export class BackendHttpClient extends Disposable {

	private authHeader: string;
	private baseUrl: string;

	constructor(
		baseUrl: string,
		password: string
	) {
		super();
		this.baseUrl = baseUrl.replace(/\/$/, '');
		this.authHeader = `Basic ${encodeBase64(VSBuffer.fromString(`fewstepsaway:${password}`))}`;
	}

	// --- Sessions --------------------------------------------------------------

	async listSessions(directory: string, token?: CancellationToken): Promise<SessionInfo[]> {
		const res = await this.requestJson<SessionListResponse>(
			`/session?directory=${encodeURIComponent(directory)}`,
			{ method: 'GET' },
			token
		);
		return res.sessions ?? [];
	}

	async createSession(body: SessionCreateRequest, token?: CancellationToken): Promise<SessionInfo> {
		const res = await this.requestJson<SessionCreateResponse>(
			'/session',
			{ method: 'POST', body },
			token
		);
		return res.data;
	}

	async deleteSession(sessionId: string, directory: string, token?: CancellationToken): Promise<void> {
		await this.requestJson(
			`/session/${encodeURIComponent(sessionId)}?directory=${encodeURIComponent(directory)}`,
			{ method: 'DELETE' },
			token
		);
	}

	async getSessionMessages(sessionId: string, directory: string, token?: CancellationToken): Promise<MessageInfo[]> {
		const res = await this.requestJson<MessageListResponse>(
			`/session/${encodeURIComponent(sessionId)}/message?directory=${encodeURIComponent(directory)}`,
			{ method: 'GET' },
			token
		);
		return res.messages ?? [];
	}

	async sendMessage(sessionId: string, body: MessageSendRequest, token?: CancellationToken): Promise<MessageInfo> {
		const res = await this.requestJson<MessageSendResponse>(
			`/session/${encodeURIComponent(sessionId)}/message?directory=${encodeURIComponent(body.directory ?? '')}`,
			{ method: 'POST', body },
			token
		);
		return res.data;
	}

	async abortSession(sessionId: string, directory: string, token?: CancellationToken): Promise<void> {
		await this.requestJson(
			`/session/${encodeURIComponent(sessionId)}/abort?directory=${encodeURIComponent(directory)}`,
			{ method: 'POST' },
			token
		);
	}

	async renameSession(sessionId: string, directory: string, title: string, token?: CancellationToken): Promise<void> {
		await this.requestJson(
			`/session/${encodeURIComponent(sessionId)}?directory=${encodeURIComponent(directory)}`,
			{ method: 'PUT', body: { title } },
			token
		);
	}

	// --- Permissions ------------------------------------------------------------

	async replyPermission(body: PermissionReplyRequest, token?: CancellationToken): Promise<void> {
		await this.requestJson(
			`/permission/${encodeURIComponent(body.id)}/reply`,
			{ method: 'POST', body },
			token
		);
	}

	// --- Questions --------------------------------------------------------------

	async answerQuestion(body: QuestionAnswerRequest, token?: CancellationToken): Promise<void> {
		await this.requestJson(
			`/question/${encodeURIComponent(body.id)}/answer`,
			{ method: 'POST', body },
			token
		);
	}

	// --- Providers --------------------------------------------------------------

	async listProviders(token?: CancellationToken): Promise<ProviderListResponse> {
		return this.requestJson<ProviderListResponse>('/provider', { method: 'GET' }, token);
	}

	// --- Health -----------------------------------------------------------------

	async checkHealth(token?: CancellationToken): Promise<boolean> {
		try {
			await this.requestJson('/global/health', { method: 'GET' }, token);
			return true;
		} catch {
			return false;
		}
	}

	// --- SSE stream -------------------------------------------------------------

	/**
	 * Open the global SSE event stream. Returns the raw Response whose body
	 * is a ReadableStream of SSE data. The SSEClient parses it.
	 */
	async openEventStream(signal?: AbortSignal): Promise<Response> { // Trigger watcher refresh
		const url = `${this.baseUrl}/global/event`;
		const init: RequestInit = {
			method: 'GET',
			headers: {
				'Authorization': this.authHeader,
				'Accept': 'text/event-stream'
			}
		};
		if (signal) {
			init.signal = signal;
		}
		const res = await fetch(url, init);
		if (!res.ok) {
			throw new Error(`SSE stream request failed: ${res.status} ${res.statusText}`);
		}
		return res;
	}

	// --- Core request helper ----------------------------------------------------

	/**
	 * Core JSON request helper. Public so the BackendService facade can
	 * delegate ad-hoc requests without going through the typed methods.
	 */
	async requestJson<T>(path: string, options: BackendRequestOptions, token?: CancellationToken): Promise<T> {
		const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
		const headers: Record<string, string> = {
			'Authorization': this.authHeader,
			'Content-Type': 'application/json',
			...options.headers
		};

		const init: RequestInit = {
			method: options.method ?? 'GET',
			headers
		};

		if (options.body !== undefined && init.method !== 'GET' && init.method !== 'DELETE') {
			init.body = JSON.stringify(options.body);
		}

		if (options.signal) {
			init.signal = options.signal;
		} else if (token) {
			init.signal = token as unknown as AbortSignal;
		}

		const res = await fetch(url, init);

		if (token?.isCancellationRequested) {
			throw canceled();
		}

		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new Error(`Backend request failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`);
		}

		const contentType = res.headers.get('content-type') ?? '';
		if (contentType.includes('application/json') || contentType.includes('text/')) {
			return await res.json() as T;
		}

		// Empty or non-JSON response
		return undefined as unknown as T;
	}

	/**
	 * Read the raw text of a response body. Used by SSEClient to parse
	 * the event stream when the ReadableStream API is unavailable.
	 */
	static async readStreamText(stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream | null): Promise<string> {
		if (!stream) { return ''; }
		// Browser-style ReadableStream<Uint8Array>
		if (typeof (stream as ReadableStream<Uint8Array>).getReader === 'function') {
			const reader = (stream as ReadableStream<Uint8Array>).getReader();
			const decoder = new TextDecoder();
			let result = '';
			for (;;) {
				const { done, value } = await reader.read();
				if (done) { break; }
				result += decoder.decode(value, { stream: true });
			}
			result += decoder.decode();
			return result;
		}
		// Node.js-style Readable (main process only)
		return BackendHttpClient.readNodeStreamText(stream as NodeJS.ReadableStream);
	}

	private static readNodeStreamText(stream: NodeJS.ReadableStream): Promise<string> {
		return new Promise((resolve, reject) => {
			const chunks: Uint8Array[] = [];
			stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
			stream.on('end', () => {
				const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
				const merged = new Uint8Array(length);
				let offset = 0;
				for (const chunk of chunks) {
					merged.set(chunk, offset);
					offset += chunk.byteLength;
				}
				resolve(new TextDecoder().decode(merged));
			});
			stream.on('error', reject);
		});
	}

	/** Node-style stream reader for SSE fallback */
	static _readStreamText = (stream: NodeJS.ReadableStream): Promise<string> => {
		return BackendHttpClient.readNodeStreamText(stream);
	};
}
