/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { BaseAIProvider } from '../common/aiProvider.js';
import { AIRequestContext, AIResponse, AIResponseChunk, ProviderCapabilities } from '../../common/types/ai.types.js';
import { IRequestService, asJson, isSuccess } from '../../../platform/request/common/request.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { streamToBuffer, VSBuffer } from '../../../base/common/buffer.js';
import { listenStream } from '../../../base/common/stream.js';

export class KiloProvider extends BaseAIProvider {
	readonly id = 'kilo';
	readonly name = 'Kilo Code';
	readonly capabilities: ProviderCapabilities = {
		supportsStreaming: true,
		supportsSystemMessages: true,
		supportsFunctionCalling: false,
		maxContextLength: 128000,
		supportedModes: ['coding', 'architect', 'debug', 'learning']
	};

	constructor(
		@IRequestService private readonly requestService: IRequestService
	) {
		super();
	}

	protected async doInitialize(): Promise<void> {
		// No custom initialization needed
	}

	protected getDefaultModel(): string {
		return 'anthropic/claude-3.5-sonnet';
	}

	async sendRequest(context: AIRequestContext): Promise<AIResponse> {
		this.validateInitialized();

		const apiKey = this.config?.apiKey || '';
		const endpoint = this.config?.endpoint || 'https://api.kilo.ai/api/gateway';
		const model = this.getModel(context);
		const messages = this.buildMessages(context);
		const startTime = Date.now();

		const url = `${endpoint}/chat/completions`;

		const requestContext = await this.requestService.request({
			type: 'POST',
			url,
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`
			},
			data: JSON.stringify({
				model,
				messages,
				temperature: context.temperature ?? 0.1,
				max_tokens: context.maxTokens ?? 4096,
				stream: false
			})
		}, CancellationToken.None);

		if (!isSuccess(requestContext)) {
			const buffer = await streamToBuffer(requestContext.stream);
			const errorText = buffer.toString();
			throw new Error(`Kilo API request failed with status ${requestContext.res.statusCode}: ${errorText}`);
		}

		const result = await asJson<any>(requestContext);
		if (!result) {
			throw new Error('Kilo API returned empty response');
		}

		return {
			content: result.choices?.[0]?.message?.content || '',
			tokensUsed: result.usage?.total_tokens || 0,
			inputTokens: result.usage?.prompt_tokens,
			outputTokens: result.usage?.completion_tokens,
			provider: this.id,
			model: result.model || model,
			latency: Date.now() - startTime,
			finishReason: result.choices?.[0]?.finish_reason || 'stop'
		};
	}

	async *streamRequest(context: AIRequestContext): AsyncIterable<AIResponseChunk> {
		this.validateInitialized();

		const apiKey = this.config?.apiKey || '';
		const endpoint = this.config?.endpoint || 'https://api.kilo.ai/api/gateway';
		const model = this.getModel(context);
		const messages = this.buildMessages(context);

		const url = `${endpoint}/chat/completions`;

		const requestContext = await this.requestService.request({
			type: 'POST',
			url,
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`
			},
			data: JSON.stringify({
				model,
				messages,
				temperature: context.temperature ?? 0.1,
				max_tokens: context.maxTokens ?? 4096,
				stream: true
			})
		}, CancellationToken.None);

		if (!isSuccess(requestContext)) {
			const buffer = await streamToBuffer(requestContext.stream);
			const errorText = buffer.toString();
			throw new Error(`Kilo API request failed with status ${requestContext.res.statusCode}: ${errorText}`);
		}

		const queue: string[] = [];
		let done = false;
		let error: Error | null = null;
		let resolveNext: (() => void) | null = null;

		let bufferStr = '';

		listenStream(requestContext.stream, {
			onData: (chunk: VSBuffer) => {
				bufferStr += chunk.toString();
				const lines = bufferStr.split('\n');
				bufferStr = lines.pop() || '';

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed) {
						continue;
					}
					if (trimmed === 'data: [DONE]') {
						done = true;
						continue;
					}
					if (trimmed.startsWith('data: ')) {
						const jsonStr = trimmed.slice(6);
						try {
							const parsed = JSON.parse(jsonStr);
							const content = parsed.choices?.[0]?.delta?.content || '';
							if (content) {
								queue.push(content);
								if (resolveNext) {
									resolveNext();
									resolveNext = null;
								}
							}
						} catch (e) {
							// Ignore parsing errors on incomplete chunks
						}
					}
				}
			},
			onError: (err) => {
				error = err;
				done = true;
				if (resolveNext) {
					resolveNext();
					resolveNext = null;
				}
			},
			onEnd: () => {
				done = true;
				if (resolveNext) {
					resolveNext();
					resolveNext = null;
				}
			}
		});

		while (!done || queue.length > 0) {
			if (queue.length === 0) {
				await new Promise<void>(resolve => {
					resolveNext = resolve;
				});
			}
			if (error) {
				throw error;
			}
			const content = queue.shift();
			if (content) {
				yield { content, isComplete: false };
			}
		}

		yield { content: '', isComplete: true };
	}

	async getAvailableModels(): Promise<string[]> {
		const staticModels = [
			'anthropic/claude-3.5-sonnet',
			'openai/gpt-4o',
			'openai/gpt-4o-mini',
			'meta-llama/llama-3.1-70b-instruct'
		];

		if (!this.initialized || !this.config?.apiKey) {
			return staticModels;
		}

		try {
			const endpoint = this.config.endpoint || 'https://api.kilo.ai/api/gateway';
			const requestContext = await this.requestService.request({
				type: 'GET',
				url: `${endpoint}/models`,
				headers: {
					'Authorization': `Bearer ${this.config.apiKey}`
				}
			}, CancellationToken.None);

			if (isSuccess(requestContext)) {
				const result = await asJson<any>(requestContext);
				if (result && Array.isArray(result.data)) {
					return result.data.map((m: any) => m.id);
				}
			}
		} catch {
			// Fall back to static models on error
		}

		return staticModels;
	}

	async validateConfig(): Promise<boolean> {
		if (!this.config || !this.config.apiKey) {
			return false;
		}
		try {
			const models = await this.getAvailableModels();
			return models.length > 0;
		} catch {
			return false;
		}
	}

	async shutdown(): Promise<void> {
		// Nothing to clean up
	}

	private buildMessages(context: AIRequestContext): { role: string; content: string }[] {
		const messages: { role: string; content: string }[] = [];

		if (this.capabilities.supportsSystemMessages) {
			messages.push({
				role: 'system',
				content: this.buildSystemPrompt(context.mode)
			});
		}

		let userContent = '';
		if (context.contextData) {
			if (context.contextData.currentFile) {
				userContent += `Active file: ${context.contextData.currentFile.path}\n`;
				userContent += `\`\`\`${context.contextData.currentFile.language}\n${context.contextData.currentFile.content}\n\`\`\`\n\n`;
			}

			if (context.contextData.openFiles && context.contextData.openFiles.length > 0) {
				userContent += `Other open files:\n`;
				for (const file of context.contextData.openFiles) {
					userContent += `File: ${file.path}\n`;
					userContent += `\`\`\`${file.language}\n${file.content}\n\`\`\`\n\n`;
				}
			}
		}

		userContent += `User Query: ${context.query}`;

		messages.push({
			role: 'user',
			content: userContent
		});

		return messages;
	}
}
