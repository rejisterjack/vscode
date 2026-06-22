/*---------------------------------------------------------------------------------------------
 *  Copyright (c) FewStepsAway Team. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { KiloProvider } from './kiloProvider.js';
import { IRequestService } from '../../../platform/request/common/request.js';
import { IRequestContext } from '../../../base/parts/request/common/request.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { bufferToStream, newWriteableBufferStream, VSBuffer } from '../../../base/common/buffer.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

class MockRequestService implements IRequestService {
	readonly _serviceBrand: undefined;

	requestResult: any = {};
	requestError?: Error;
	requestStreamChunks: string[] = [];
	lastRequestOptions?: any;
	statusCode = 200;

	async request(options: any, token: CancellationToken): Promise<IRequestContext> {
		this.lastRequestOptions = options;
		if (this.requestError) {
			throw this.requestError;
		}

		let stream;
		if (options.data && JSON.parse(options.data).stream) {
			const bufferStream = newWriteableBufferStream();
			stream = bufferStream;
			(async () => {
				for (const chunk of this.requestStreamChunks) {
					await new Promise(resolve => setTimeout(resolve, 5));
					bufferStream.write(VSBuffer.fromString(chunk));
				}
				bufferStream.end();
			})();
		} else {
			const responseData = JSON.stringify(this.requestResult || {});
			stream = bufferToStream(VSBuffer.fromString(responseData));
		}

		return {
			res: {
				statusCode: this.statusCode,
				headers: {}
			},
			stream
		};
	}

	async resolveProxy(url: string) { return undefined; }
	async lookupAuthorization(authInfo: any) { return undefined; }
	async lookupKerberosAuthorization(url: string) { return undefined; }
	async loadCertificates() { return []; }
}

suite('KiloProvider', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	let requestService: MockRequestService;
	let provider: KiloProvider;

	setup(() => {
		requestService = new MockRequestService();
		provider = new KiloProvider(requestService);
	});

	test('should initialize and hold configuration', async () => {
		const config = {
			providerId: 'kilo',
			apiKey: 'test-api-key',
			endpoint: 'https://custom-gateway.kilo.ai',
			defaultModel: 'anthropic/claude-3.5-sonnet',
			enabled: true
		};

		await provider.initialize(config);
		assert.strictEqual(provider.id, 'kilo');
		assert.strictEqual(provider.name, 'Kilo Code');
	});

	test('should sendRequest successfully', async () => {
		const config = {
			providerId: 'kilo',
			apiKey: 'test-api-key',
			endpoint: 'https://api.kilo.ai/api/gateway',
			defaultModel: 'anthropic/claude-3.5-sonnet',
			enabled: true
		};
		await provider.initialize(config);

		requestService.requestResult = {
			choices: [
				{
					message: {
						role: 'assistant',
						content: 'Hello from Kilo!'
					},
					finish_reason: 'stop'
				}
			],
			usage: {
				total_tokens: 15,
				prompt_tokens: 10,
				completion_tokens: 5
			},
			model: 'anthropic/claude-3.5-sonnet'
		};

		const response = await provider.sendRequest({
			query: 'Hi',
			mode: 'coding'
		});

		assert.strictEqual(response.content, 'Hello from Kilo!');
		assert.strictEqual(response.tokensUsed, 15);
		assert.strictEqual(response.provider, 'kilo');
		assert.strictEqual(response.model, 'anthropic/claude-3.5-sonnet');
		assert.strictEqual(response.finishReason, 'stop');

		// Verify request details
		const options = requestService.lastRequestOptions;
		assert.strictEqual(options.type, 'POST');
		assert.strictEqual(options.url, 'https://api.kilo.ai/api/gateway/chat/completions');
		assert.strictEqual(options.headers['Authorization'], 'Bearer test-api-key');

		const body = JSON.parse(options.data);
		assert.strictEqual(body.model, 'anthropic/claude-3.5-sonnet');
		assert.strictEqual(body.stream, false);
		assert.strictEqual(body.messages[1].content, 'User Query: Hi');
	});

	test('should streamRequest successfully', async () => {
		const config = {
			providerId: 'kilo',
			apiKey: 'test-api-key',
			endpoint: 'https://api.kilo.ai/api/gateway',
			defaultModel: 'anthropic/claude-3.5-sonnet',
			enabled: true
		};
		await provider.initialize(config);

		requestService.requestStreamChunks = [
			'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n',
			'data: {"choices":[{"delta":{"content":"from "}}]}\n\n',
			'data: {"choices":[{"delta":{"content":"stream!"}}]}\n\n',
			'data: [DONE]\n\n'
		];

		const chunks: string[] = [];
		for await (const chunk of provider.streamRequest({ query: 'Hi', mode: 'coding' })) {
			if (chunk.content) {
				chunks.push(chunk.content);
			}
		}

		assert.deepStrictEqual(chunks, ['Hello ', 'from ', 'stream!']);

		// Verify request details
		const options = requestService.lastRequestOptions;
		assert.strictEqual(options.type, 'POST');
		assert.strictEqual(options.url, 'https://api.kilo.ai/api/gateway/chat/completions');

		const body = JSON.parse(options.data);
		assert.strictEqual(body.stream, true);
	});
});
