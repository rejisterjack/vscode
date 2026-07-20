---
name: add-ai-provider
description: Use when adding a new AI model/API provider (e.g. a new LLM vendor) to FewStepsAway's AI integration layer — implements the IAIProvider contract, registers it, wires configuration, and adds tests.
---

# Add an AI Provider

Follow this sequence when adding support for a new AI provider under `src/vs/ai/provider/`. See `.cursor/rules/10-provider-implementation.mdc` and `.cursor/rules/00-vscode-fork-conventions.mdc` for the conventions enforced at each step.

## Steps

1. **Create the provider folder and file.**
   Put the new provider in its own folder under `src/vs/ai/provider/<name>/`, e.g. `src/vs/ai/provider/myprovider/myProvider.ts`. Add an `index.ts` barrel if the folder has multiple files.

2. **Implement `IAIProvider`.**
   Implement every required field and method — do not leave any as a stub that throws:
   - `id: string` — unique, lowercase, matches the config namespace (see step 4).
   - `name: string` — human-readable display name.
   - `capabilities: ProviderCapabilities` — set `supportsStreaming`, `supportsSystemMessages`, `supportsFunctionCalling`, `maxContextLength`, and `supportedModes` accurately; other AI-layer code branches on these flags.
   - `initialize(config: ProviderConfig): Promise<void>` — validate required config (e.g. API key present), throw `AIProviderError` (not a bare `Error`) on invalid config.
   - `sendRequest(context: AIRequestContext): Promise<AIResponse>` — the non-streaming call path.
   - `streamRequest(context: AIRequestContext): AsyncIterable<AIResponseChunk>` — the streaming call path (an async generator), even if the underlying API's streaming support is simulated by chunking a single response when `supportsStreaming` must be `false`.
   - Wrap upstream API errors in `AIProviderError` (or `AIRateLimitError` for 429s, setting `retryable: true` and `retryAfter`) — never let a raw SDK error escape `sendRequest`/`streamRequest`.

3. **Register the provider.**
   In `providerRegistry.ts`, register an instance:
   ```typescript
   registry.register('myprovider', new MyProvider());
   ```
   Don't let call sites `new MyProvider()` directly — always resolve through the registry so provider selection stays centralized.

4. **Add its configuration schema.**
   In `configuration.ts`, add the namespaced settings for this provider:
   ```typescript
   'ai.provider.myprovider.apiKey': {
       type: 'string',
       default: '',
       description: 'My Provider API Key'
   }
   ```
   Add any other provider-specific settings (base URL, model override, etc.) under the same `ai.provider.myprovider.*` namespace. If the provider should be selectable as the default, also add it to the `ai.provider.default` enum.

5. **Add unit tests.**
   Create `src/vs/ai/provider/<name>/<name>Provider.test.ts` colocated with the implementation. Cover:
   - `sendRequest` success path (assert `content`, `tokensUsed`, `provider` on the response).
   - `sendRequest` failure path — upstream API error is surfaced as `AIProviderError`.
   - `streamRequest` yields chunks and terminates with `isComplete: true`.
   Use the shared `createMockAIProvider()` pattern (see `.cursor/rules/20-testing.mdc`) when testing *consumers* of `IAIProvider`; for testing the provider itself, mock only its underlying SDK client, not the whole provider.

6. **Verify.**
   - `npm run eslint` — must pass with no new errors.
   - `bun test src/vs/ai/**/*.test.ts src/vs/ai/tool/tools/*.test.ts` — the AI-module test suite; must include and pass your new test file.
   - If the change also touches non-AI code (e.g. a shared type in `src/vs/ai/common/`), also run `npm run test-node`.
