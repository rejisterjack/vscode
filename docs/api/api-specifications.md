# API Specifications

## 1. Internal Component APIs

### 1.1 AI Service API

• Purpose: Abstracts communication with multiple AI providers, ensuring a consistent interface.
• Methods:
  - sendRequest(context: AIRequestContext): Promise<AIResponse>
  - configure(settings: ProviderSettings): Promise<void>
  - getCapabilities(): Promise<ProviderCapabilities>

• Request/Response Structure:
  - AIRequestContext:
    {
      userId?: string,
      query: string,
      contextData?: any,
      mode: 'coding' | 'architect' | 'debug' | 'learning',
    }
  - AIResponse:
    {
      content: string,
      tokensUsed: number,
      provider: string,
      additionalMeta?: any,
    }

• Error Handling:
  - Provide clear error codes for rate-limits, invalid requests, or provider issues.
  - Expose fallback strategies if recommended.

### 1.2 Context Manager API

• Purpose: Aggregates relevant file data, user settings, open editor data for AI consumption.
• Methods:
  - gatherContext(userId: string): Promise<ContextPayload>
  - updateContext(change: ContextChange): void

• Data Structures:
  - ContextPayload: Contains references to open files, recent edits, relevant project metadata.
  - ContextChange: Represents incremental changes (file edit, new file, focus shift).

### 1.3 Indexing Engine API

• Purpose: Maintains a semantic index for code search, refactoring, debugging context.
• Methods:
  - indexFile(filePath: string, content: string): Promise<void>
  - search(query: string): Promise<SearchResult[]>
  - removeFile(filePath: string): Promise<void>

### 1.4 UI Component APIs

• Purpose: Provide a means for the VS Code fork's UI to interact with AI features.
• Methods:
  - showSuggestions(suggestions: AISuggestion[]): void
  - openChatPane(): void
  - showRefactorPreview(diff: string): void

## 2. Configuration API

• Purpose: Manage user settings, AI provider registration, credential storage.
• Endpoints/Methods:
  - getUserConfig(userId: string): UserConfig
  - updateUserConfig(userId: string, config: Partial<UserConfig>): void
  - listProviders(): AIProviderInfo[]
  - addProvider(info: AIProviderInfo): void
  - removeProvider(providerName: string): void

• Data Structures:
  - UserConfig: {
      userId: string,
      preferredModel: string,
      anonymousTelemetryOptIn: boolean,
      …
    }
  - AIProviderInfo: {
      providerName: string,
      baseUrl: string,
      apiKey?: string,
      localModel?: boolean,
      …
    }

## 3. Extension API

• Purpose: Allow VS Code extensions to hook into AI features.
• Major Functions:
  - `onBeforeAIRequest(callback: (ctx: AIRequestContext) => AIRequestContext)`: Intercept or modify AI requests.
  - `onAIResponse(callback: (res: AIResponse) => void)`: Access responses for custom handling.
  - `registerAICommand(commandName: string, handler: (args: any) => Promise<any>)`: Define custom commands leveraging AI.

• Use Cases:
  - Telemetry extension might gather stats from AI requests.
  - Custom code analysis extension might enrich context with domain-specific data.

## 4. Provider Integration API

• Purpose: developers can add new AI providers without modifying core.
• Key Concepts:
  - Implementation of a `ProviderEngine` class with required methods: `initialize()`, `invoke()`, `shutdown()`.
  - Registration into a global `AIProviderRegistry`.

### Example ProviderEngine Interface:

```ts
interface ProviderEngine {
  initialize(config: ProviderConfig): Promise<void>;
  invoke(payload: AIRequestContext): Promise<AIResponse>;
  shutdown?(): Promise<void>;
}
```

• Steps to add new provider:
  1. Implement `ProviderEngine` interface.
  2. Register with `AIProviderRegistry.add('providerName', new MyProviderEngine())`.

## 5. External APIs

### 5.1 AI Provider HTTP Endpoints (Third-Party)

• OpenAI, Anthropic, Google, AWS, etc.
• Typically REST-based or gRPC, exchanging JSON.
• Rate limits, authentication tokens, model parameters.

### 5.2 Local Model Endpoints

• If local runtime is used, possibly a local server or direct library call.
• Same interface but internally hooking into an offline model.

## 6. Authentication & Authorization

• Internal components share an in-process API, so minimal overhead.
• External calls to AI providers require valid API keys.
• If multi-user or enterprise scenario arises, a simple token-based or OAuth flow could be introduced.

## 7. Error Handling & Versioning

• Each API method must return standardized error objects with codes and messages.
• Versions:
  - Internal APIs versioned by code release.
  - Configuration & Extension APIs semver-based to avoid breaking changes.

## 8. Rate Limiting & Quotas

• At the AI Service layer, apply user-level or global application-level rate limits.
• Provide user feedback if limits are approached.

## 9. Example Flow

• The user triggers a refactor command.
• The UI calls `ContextManager.gatherContext()`.
• The combined context is passed to `AIService.sendRequest()`.
• The selected provider is invoked.
• Response is returned to UI, showing a preview of recommended changes.

---

This specification ensures clarity about the interfaces used within the AI-native code editor, how it interacts with external providers, and how extension developers can customize or extend AI functionalities.
