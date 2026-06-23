/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Display order for provider / vendor groups in pickers (lower = higher in list). */
export const PROVIDER_PICKER_ORDER: Record<string, number> = {
	openai: 10,
	zai: 15,
	anthropic: 20,
	google: 30,
	'google-vertex': 35,
	openrouter: 40,
	deepseek: 50,
	mistral: 60,
	xai: 70,
	azure: 80,
	'amazon-bedrock': 90,
	groq: 95,
	togetherai: 96,
	cerebras: 97,
	deepinfra: 98,
	fireworks: 99,
	baseten: 100,
	ollama: 110,
	lmstudio: 120,
};

export function compareProviderIds(a: string, b: string): number {
	const orderA = PROVIDER_PICKER_ORDER[a] ?? 500;
	const orderB = PROVIDER_PICKER_ORDER[b] ?? 500;
	if (orderA !== orderB) {
		return orderA - orderB;
	}
	return a.localeCompare(b);
}
