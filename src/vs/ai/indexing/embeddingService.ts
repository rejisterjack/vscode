/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IFewStepsAwayAuthService } from '../auth/fewStepsAwayAuthService.js';
import { IRequestService } from '../../platform/request/common/request.js';
import { CancellationToken } from '../../base/common/cancellation.js';
import { streamToBuffer } from '../../base/common/buffer.js';

export const IEmbeddingService = createDecorator<IEmbeddingService>('ai.embeddingService');

export interface IEmbeddingService {
	readonly _serviceBrand: undefined;
	embed(text: string): Promise<number[]>;
	embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * Embedding service — uses platform gateway when signed in, falls back to TF hash vector.
 */
export class EmbeddingService implements IEmbeddingService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IConfigurationService private readonly configService: IConfigurationService,
		@IFewStepsAwayAuthService private readonly authService: IFewStepsAwayAuthService,
		@IRequestService private readonly requestService: IRequestService,
	) { }

	async embed(text: string): Promise<number[]> {
		const [vec] = await this.embedBatch([text]);
		return vec;
	}

	async embedBatch(texts: string[]): Promise<number[][]> {
		const token = await this.authService.getAccessToken();
		const baseUrl = this.configService.getValue<string>('ai.backend.apiUrl') ?? 'http://localhost:21000/api/v1';
		if (token) {
			try {
				const response = await this.requestService.request({
					type: 'POST',
					url: `${baseUrl}/ai/embeddings`,
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`,
						'Accept': 'application/json',
					},
					data: JSON.stringify({ texts }),
				}, CancellationToken.None);
				const body = JSON.parse((await streamToBuffer(response.stream)).toString()) as { embeddings?: number[][] };
				if (body.embeddings?.length === texts.length) {
					return body.embeddings;
				}
			} catch {
				// fall through to local
			}
		}
		return texts.map(t => localHashEmbedding(t, 128));
	}
}

function localHashEmbedding(text: string, dims: number): number[] {
	const vec = new Array<number>(dims).fill(0);
	for (let i = 0; i < text.length; i++) {
		const idx = (text.charCodeAt(i) * (i + 1)) % dims;
		vec[idx] += 1;
	}
	const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
	return vec.map(v => v / norm);
}

registerSingleton(IEmbeddingService, EmbeddingService, InstantiationType.Delayed);
