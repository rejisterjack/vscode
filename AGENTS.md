# FewStepAway - AI Coding Agent Instructions

## Project Overview

**FewStepAway** is an open-source, AI-native code editor built by forking VS Code and embedding AI capabilities natively. The goal is to create an editor where AI is woven into every interaction, not bolted on as an afterthought.

### Key Characteristics
- **Fork of VS Code**: Built on top of the official VS Code codebase
- **Native AI Integration**: AI features are core to the editor, not extensions
- **Multi-Provider Support**: Works with OpenAI, Anthropic, Google, AWS, OpenRouter, and local models
- **Apache 2.0 License**: Fully open-source and community-driven
- **VS Code Compatibility**: Existing extensions work seamlessly

---

## Project Structure

```
fewstepaway/
├── src/                          # Main source code
│   ├── vs/                       # VS Code core modules
│   │   ├── base/                 # Base utilities and common code
│   │   ├── editor/               # Editor components
│   │   ├── workbench/            # Workbench UI
│   │   ├── platform/             # Platform abstractions
│   │   └── code/                 # Application entry points
│   └── vs/ai/                    # 🎯 AI INTEGRATION LAYER (our additions)
│       ├── common/               # Shared types and utilities
│       ├── provider/             # AI provider implementations
│       ├── context/              # Context management
│       ├── indexing/             # Codebase indexing
│       ├── completion/           # Inline completions
│       ├── chat/                 # Chat interface
│       ├── refactoring/          # Code refactoring
│       ├── debug/                # AI debugging
│       ├── search/               # Semantic search
│       └── extension-api/        # Extension integration
│
├── docs/                         # Documentation
│   ├── architecture/             # System architecture
│   ├── specifications/           # Technical specifications
│   ├── api/                      # API documentation
│   ├── database/                 # Database schemas
│   ├── infrastructure/           # Infrastructure requirements
│   ├── roadmap/                  # Implementation roadmap
│   └── IMPLEMENTATION_PLAN.md    # 📖 Complete implementation plan
│
├── extensions/                   # Built-in extensions
├── build/                        # Build scripts and configuration
├── scripts/                      # Development scripts
├── test/                         # Test suites
├── cli/                          # CLI tools (Rust)
└── references/                   # Reference implementations
```

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                           │
│         (Editor Widget, Chat Panel, Status Bar)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI INTEGRATION LAYER                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │  AI      │ │ Context  │ │ Suggest- │ │  Chat    │ │ Debug  │ │
│  │ Service  │ │ Manager  │ │ ion Eng. │ │ Service  │ │ Assist │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │  Index   │ │ Refactor │ │ Extension│                        │
│  │  Manager │ │  Engine  │ │    API   │                        │
│  └──────────┘ └──────────┘ └──────────┘                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA & STORAGE LAYER                          │
│         (Settings, Conversations, Index, Cache)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   EXTERNAL AI PROVIDERS                          │
│    OpenAI │ Anthropic │ Google │ AWS │ OpenRouter │ Local       │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

1. **AI Service Abstraction** (`src/vs/ai/provider/`)
   - Provides unified interface for all AI providers
   - Handles rate limiting, retries, and fallbacks
   - Supports streaming and non-streaming requests

2. **Context Manager** (`src/vs/ai/context/`)
   - Gathers code context from open files, recent edits, project structure
   - Manages token budgets and context prioritization
   - Integrates with Git for diff/context

3. **Codebase Indexing** (`src/vs/ai/indexing/`)
   - Maintains semantic and keyword indexes
   - Enables natural language code search
   - Incremental updates on file changes

---

## Coding Standards

### TypeScript Conventions

1. **Use strict TypeScript**
   ```typescript
   // ✅ Good
   function processRequest(context: AIRequestContext): Promise<AIResponse> {
       // Implementation
   }
   
   // ❌ Avoid
   function processRequest(context: any): any {
       // Implementation
   }
   ```

2. **Interface naming**
   ```typescript
   // ✅ Good - I prefix for interfaces
   interface IAIProvider { }
   interface IContextManager { }
   
   // Class names without I prefix
   class OpenAIProvider implements IAIProvider { }
   ```

3. **Dependency Injection**
   ```typescript
   // ✅ Good - Use VS Code's DI system
   export class ChatService implements IChatService {
       constructor(
           @IAIService private readonly aiService: IAIService,
           @IContextManager private readonly contextManager: IContextManager,
           @ILogService private readonly logService: ILogService
       ) { }
   }
   ```

4. **Disposable Pattern**
   ```typescript
   // ✅ Good - Always clean up resources
   export class ContextManager extends Disposable implements IContextManager {
       private readonly _onContextChanged = this._register(new Emitter<ContextChange>());
       
       registerListeners(): void {
           this._register(this.editorService.onDidChange(() => {
               this.handleChange();
           }));
       }
   }
   ```

5. **Event Handling**
   ```typescript
   // ✅ Good - Use Event/Emitter pattern
   export class MyService {
       private readonly _onEvent = new Emitter<MyEventType>();
       readonly onEvent: Event<MyEventType> = this._onEvent.event;
       
       triggerEvent(): void {
           this._onEvent.fire({ /* data */ });
       }
   }
   ```

### File Organization

1. **One class/interface per file** (generally)
2. **Group related files in folders**
3. **Use index.ts for exports**
   ```typescript
   // src/vs/ai/provider/common/index.ts
   export * from './aiProvider';
   export * from './providerRegistry';
   export * from './rateLimiter';
   ```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Interfaces | PascalCase with I prefix | `IAIProvider` |
| Classes | PascalCase | `OpenAIProvider` |
| Methods/Variables | camelCase | `sendRequest` |
| Constants | UPPER_SNAKE_CASE | `MAX_CONTEXT_TOKENS` |
| Enums | PascalCase | `AIMode` |
| Type aliases | PascalCase | `AIRequestContext` |

---

## AI Module Development Guidelines

### Provider Implementation

When adding a new AI provider:

1. **Implement the IAIProvider interface**
   ```typescript
   export class MyProvider implements IAIProvider {
       readonly id = 'myprovider';
       readonly name = 'My Provider';
       readonly capabilities: ProviderCapabilities = {
           supportsStreaming: true,
           supportsSystemMessages: true,
           supportsFunctionCalling: false,
           maxContextLength: 128000,
           supportedModes: ['coding', 'architect', 'debug', 'learning']
       };
       
       async initialize(config: ProviderConfig): Promise<void> { }
       async sendRequest(context: AIRequestContext): Promise<AIResponse> { }
       async *streamRequest(context: AIRequestContext): AsyncIterable<AIResponseChunk> { }
   }
   ```

2. **Register in ProviderRegistry**
   ```typescript
   // In providerRegistry.ts
   registry.register('myprovider', new MyProvider());
   ```

3. **Add configuration schema**
   ```typescript
   // In configuration.ts
   'ai.provider.myprovider.apiKey': {
       type: 'string',
       default: '',
       description: 'My Provider API Key'
   }
   ```

### Error Handling

```typescript
// ✅ Good - Use custom error types
export class AIProviderError extends Error {
    constructor(
        message: string,
        public readonly provider: string,
        public readonly code: string,
        public readonly retryable: boolean = false
    ) {
        super(message);
    }
}

export class AIRateLimitError extends AIProviderError {
    constructor(provider: string, public readonly retryAfter: number) {
        super('Rate limit exceeded', provider, 'RATE_LIMIT', true);
    }
}

// Usage
async function sendWithRetry(context: AIRequestContext): Promise<AIResponse> {
    try {
        return await provider.sendRequest(context);
    } catch (error) {
        if (error instanceof AIRateLimitError && error.retryable) {
            await delay(error.retryAfter * 1000);
            return sendWithRetry(context);
        }
        throw error;
    }
}
```

### Context Building

```typescript
// ✅ Good - Respect token budgets
export class ContextManager {
    private readonly MAX_TOKENS = 4000;
    
    async gatherContext(options: ContextOptions = {}): Promise<CodeContext> {
        const currentFile = await this.getCurrentFileContext();
        let tokensUsed = this.estimateTokens(currentFile?.content || '');
        
        const openFiles: FileContext[] = [];
        
        // Add open files until we hit the token limit
        for (const file of this.getOpenFiles()) {
            const fileTokens = this.estimateTokens(file.content);
            if (tokensUsed + fileTokens > this.MAX_TOKENS) {
                break;
            }
            openFiles.push(file);
            tokensUsed += fileTokens;
        }
        
        return { currentFile, openFiles };
    }
    
    private estimateTokens(text: string): number {
        // Rough estimation: 1 token ≈ 4 characters
        return Math.ceil(text.length / 4);
    }
}
```

---

## Testing Guidelines

### Unit Tests

```typescript
// ✅ Good - Test file naming: {module}.test.ts
// src/vs/ai/provider/openai/openaiProvider.test.ts

describe('OpenAIProvider', () => {
    let provider: OpenAIProvider;
    
    beforeEach(() => {
        provider = new OpenAIProvider();
    });
    
    describe('sendRequest', () => {
        it('should return valid AIResponse on success', async () => {
            // Arrange
            const mockClient = createMockOpenAI();
            (provider as any).client = mockClient;
            
            // Act
            const result = await provider.sendRequest({
                query: 'test',
                mode: 'coding'
            });
            
            // Assert
            expect(result.content).toBeDefined();
            expect(result.tokensUsed).toBeGreaterThan(0);
            expect(result.provider).toBe('openai');
        });
        
        it('should throw AIProviderError on API failure', async () => {
            // Arrange
            const mockClient = createMockOpenAI();
            mockClient.chat.completions.create.mockRejectedValue(new Error('API Error'));
            (provider as any).client = mockClient;
            
            // Act & Assert
            await expect(provider.sendRequest({ query: 'test', mode: 'coding' }))
                .rejects.toThrow(AIProviderError);
        });
    });
});
```

### Integration Tests

```typescript
// ✅ Good - Test service integration
// src/vs/ai/test/integration/chatService.test.ts

describe('ChatService Integration', () => {
    let chatService: IChatService;
    let aiService: IAIService;
    
    beforeEach(async () => {
        const app = await createTestApp();
        chatService = app.get(IChatService);
        aiService = app.get(IAIService);
    });
    
    it('should complete full conversation flow', async () => {
        // Create conversation
        const conversation = await chatService.createConversation('coding');
        expect(conversation.messages).toHaveLength(1); // System message
        
        // Send message
        await chatService.sendMessage(conversation.id, 'Hello');
        
        // Verify response
        const updated = await chatService.getConversation(conversation.id);
        expect(updated.messages).toHaveLength(3); // System + User + Assistant
    });
});
```

### Mocking AI Providers

```typescript
// ✅ Good - Mock provider for testing
export function createMockAIProvider(): IAIProvider {
    return {
        id: 'mock',
        name: 'Mock Provider',
        capabilities: {
            supportsStreaming: true,
            supportsSystemMessages: true,
            supportsFunctionCalling: true,
            maxContextLength: 128000,
            supportedModes: ['coding', 'architect', 'debug', 'learning']
        },
        initialize: jest.fn(),
        sendRequest: jest.fn().mockResolvedValue({
            content: 'Mock response',
            tokensUsed: 100,
            provider: 'mock',
            model: 'mock-model',
            latency: 50,
            finishReason: 'stop'
        }),
        streamRequest: jest.fn().mockImplementation(async function* () {
            yield { content: 'Mock ', isComplete: false };
            yield { content: 'response', isComplete: true };
        }),
        getAvailableModels: jest.fn().mockResolvedValue(['mock-model']),
        validateConfig: jest.fn().mockResolvedValue(true),
        shutdown: jest.fn()
    };
}
```

---

## Common Patterns

### 1. Service Registration

```typescript
// In your service file
export class MyService implements IMyService {
    // Implementation
}

// Register in workbench.ts or similar
registerSingleton(IMyService, MyService, InstantiationType.Delayed);
```

### 2. Configuration Contribution

```typescript
// In package.json contributes.configuration
{
    "id": "ai",
    "order": 20,
    "title": "AI Features",
    "properties": {
        "ai.provider.default": {
            "type": "string",
            "default": "openai",
            "enum": ["openai", "anthropic", "google"],
            "description": "%config.ai.provider.default%"
        }
    }
}
```

### 3. Command Registration

```typescript
// Register AI commands
CommandsRegistry.registerCommand({
    id: 'ai.chat.open',
    handler: (accessor) => {
        const chatService = accessor.get(IChatService);
        chatService.openChatPanel();
    }
});

// Add to command palette
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
    command: {
        id: 'ai.chat.open',
        title: { value: 'AI: Open Chat', original: 'AI: Open Chat' },
        category: 'AI'
    }
});
```

### 4. Keybinding Registration

```typescript
// In keybindings configuration
{
    "key": "ctrl+shift+a",
    "command": "ai.chat.open",
    "when": "editorTextFocus"
},
{
    "key": "tab",
    "command": "ai.completion.accept",
    "when": "aiCompletionVisible && editorTextFocus"
}
```

---

## Development Workflow

### Setting Up Development Environment

```bash
# 1. Clone and install
git clone https://github.com/rejisterjack/fewstepaway.git
cd fewstepaway
npm install

# 2. Build
npm run compile

# 3. Run in development mode
./scripts/code.sh
```

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/my-ai-feature
   ```

2. **Implement your changes**
   - Follow coding standards
   - Add tests
   - Update documentation

3. **Run tests**
   ```bash
   # Unit tests
   npm run test-node
   
   # AI module tests
   npm run test-ai
   
   # Linting
   npm run eslint
   ```

4. **Test manually**
   ```bash
   ./scripts/code.sh
   ```

5. **Submit PR**
   - Fill out PR template
   - Link related issues
   - Ensure CI passes

---

## Important Considerations

### 1. VS Code Fork Maintenance

- **Minimize changes to core VS Code files**
- **Use extension points where possible**
- **Keep AI code isolated in `src/vs/ai/`**
- **Document any VS Code core modifications**

### 2. Performance

- **Lazy load AI components** - Don't initialize until needed
- **Cache AI responses** - Avoid redundant API calls
- **Debounce rapid requests** - Especially for inline completions
- **Respect token limits** - Don't send too much context

### 3. Privacy & Security

- **Never log API keys**
- **Filter PII before sending to AI providers**
- **Support local-only mode**
- **Encrypt sensitive storage**

### 4. Error Handling

- **Always handle provider failures gracefully**
- **Provide meaningful error messages to users**
- **Implement retry logic with exponential backoff**
- **Have fallback providers**

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile TypeScript |
| `npm run watch` | Watch mode compilation |
| `npm run test-node` | Run unit tests |
| `npm run test-ai` | Run AI module tests |
| `npm run eslint` | Run linting |
| `./scripts/code.sh` | Run development build |
| `./scripts/code-cli.sh` | Run CLI version |

---

## Resources

- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) - Complete feature roadmap
- [Technical Specifications](docs/specifications/technical-specifications.md)
- [System Architecture](docs/architecture/system-architecture.md)
- [API Specifications](docs/api/api-specifications.md)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Contribution Guide](CONTRIBUTING.md)

---

## Questions?

- Check the [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) for detailed specifications
- Review existing implementations in `src/vs/ai/`
- Ask in the project's discussion forum

---

*Happy coding! Remember: AI should feel native, not bolted-on.*
