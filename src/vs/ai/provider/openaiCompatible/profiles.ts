/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * OpenAI-compatible provider profiles. Each profile defines the provider id,
 * display name, and base URL. One `OpenAICompatibleProvider` class powers all
 * of them.
 *
 * Port of `references/kilocode/packages/llm/src/providers/openai-compatible-profile.ts:6-16`.
 */
export interface ProviderProfile {
	readonly provider: string;
	readonly baseURL: string;
	readonly displayName?: string;
}

export const profiles = {
	deepseek: { provider: 'deepseek', baseURL: 'https://api.deepseek.com/v1', displayName: 'DeepSeek' },
	groq: { provider: 'groq', baseURL: 'https://api.groq.com/openai/v1', displayName: 'Groq' },
	togetherai: { provider: 'togetherai', baseURL: 'https://api.together.xyz/v1', displayName: 'Together AI' },
	cerebras: { provider: 'cerebras', baseURL: 'https://api.cerebras.ai/v1', displayName: 'Cerebras' },
	deepinfra: { provider: 'deepinfra', baseURL: 'https://api.deepinfra.com/v1/openai', displayName: 'DeepInfra' },
	fireworks: { provider: 'fireworks', baseURL: 'https://api.fireworks.ai/inference/v1', displayName: 'Fireworks AI' },
	baseten: { provider: 'baseten', baseURL: 'https://inference.baseten.co/v1', displayName: 'Baseten' },
} as const satisfies Record<string, ProviderProfile>;

export type ProfileId = keyof typeof profiles;

export function getProfile(id: string): ProviderProfile | undefined {
	return (profiles as Record<string, ProviderProfile>)[id];
}

export function getAllProfileIds(): string[] {
	return Object.keys(profiles);
}
