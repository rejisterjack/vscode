# FewStepAway - Complete Implementation Plan

## Executive Summary

This document provides a comprehensive implementation plan for transforming FewStepAway from a VS Code fork into a fully AI-native code editor. The plan covers all backend development aspects from foundational infrastructure to advanced AI features.

---

## Table of Contents

1. [Project Overview & Goals](#1-project-overview--goals)
2. [Architecture Overview](#2-architecture-overview)
3. [Phase 1: Foundation (Months 1-3)](#3-phase-1-foundation-months-1-3)
4. [Phase 2: Core AI Features (Months 4-6)](#4-phase-2-core-ai-features-months-4-6)
5. [Phase 3: Advanced Features (Months 7-9)](#5-phase-3-advanced-features-months-7-9)
6. [Phase 4: Polish & Ecosystem (Months 10-12)](#6-phase-4-polish--ecosystem-months-10-12)
7. [Backend Services Detailed Design](#7-backend-services-detailed-design)
8. [Data Layer & Storage](#8-data-layer--storage)
9. [Security & Privacy Implementation](#9-security--privacy-implementation)
10. [Testing Strategy](#10-testing-strategy)
11. [Deployment & DevOps](#11-deployment--devops)
12. [Risk Mitigation](#12-risk-mitigation)

---

## 1. Project Overview & Goals

### 1.1 Vision Statement
Build an open-source, AI-native code editor that embeds AI capabilities natively into VS Code, providing:
- **Native AI Integration** - No extension overhead, instant AI interactions
- **Provider Freedom** - Support for 500+ models across multiple providers
- **Full Transparency** - Apache 2.0 license, community-driven
- **VS Code Compatibility** - Existing extensions work seamlessly

### 1.2 Success Metrics
| Metric | Target |
|--------|--------|
| Startup Time | < 2 seconds (VS Code baseline) |
| AI Response Latency | < 200ms for inline suggestions |
| Memory Overhead | < 10% vs stock VS Code |
| Indexing Speed | < 1 minute for large codebases |
| Test Coverage | > 80% for AI modules |
| Extension Compatibility | > 95% of popular extensions |

---

## 2. Architecture Overview

### 2.1 High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FEWSTEPAWAY ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PRESENTATION LAYER (UI)                          │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐  │   │
│  │  │   Editor     │ │ Chat Panel   │ │   Status     │ │  Command   │  │   │
│  │  │   Widget     │ │   View       │ │    Bar       │ │  Palette   │  │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                 AI INTEGRATION LAYER                                │   │
│  │                                                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │   AI Service │  │   Context    │  │  Suggestion  │              │   │
│  │  │  Abstraction │  │   Manager    │  │   Engine     │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │                                                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │   Codebase   │  │Conversation/ │  │   Debug      │              │   │
│  │  │   Indexing   │  │Chat Interface│  │  Assistant   │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │                                                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ Refactoring  │  │   Provider   │  │  Extension   │              │   │
│  │  │    Engine    │  │   Registry   │  │     API      │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   DATA & STORAGE LAYER                              │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐  │   │
│  │  │  Settings    │ │ Conversation │ │    Code      │ │   Cache    │  │   │
│  │  │   Store      │ │    Store     │ │    Index     │ │   Store    │  │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              EXTERNAL AI PROVIDERS                                  │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐   │   │
│  │  │ OpenAI  │ │Anthropic│ │ Google  │ │  AWS    │ │ OpenRouter  │   │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    LOCAL MODELS                             │   │   │
│  │  │  (Ollama, LM Studio, LocalAI, Custom Endpoints)             │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Module Structure

```
src/vs/ai/
├── common/                          # Shared types and utilities
│   ├── types/
│   │   ├── ai.types.ts             # Core AI types
│   │   ├── provider.types.ts       # Provider interface types
│   │   ├── context.types.ts        # Context management types
│   │   └── conversation.types.ts   # Chat/conversation types
│   └── utils/
│       ├── tokenizer.ts            # Token counting utilities
│       └── contextBuilder.ts       # Context assembly utilities
│
├── provider/                        # AI Provider implementations
│   ├── common/
│   │   ├── aiProvider.ts           # Base provider interface
│   │   ├── providerRegistry.ts     # Provider registration
│   │   └── rateLimiter.ts          # Rate limiting service
│   ├── openai/
│   ├── anthropic/
│   ├── google/
│   ├── aws/
│   ├── openrouter/
│   └── local/
│       ├── ollama.ts
│       └── lmStudio.ts
│
├── context/                         # Context management
│   ├── contextManager.ts           # Main context manager
│   ├── contextBuilder.ts           # Context assembly
│   ├── fileTracker.ts              # File change tracking
│   └── gitIntegration.ts           # Git diff/context
│
├── indexing/                        # Codebase indexing
│   ├── indexManager.ts             # Index orchestration
│   ├── semanticIndex.ts            # Vector/semantic index
│   ├── keywordIndex.ts             # Traditional search index
│   └── parsers/
│       ├── typescriptParser.ts
│       └── pythonParser.ts
│
├── completion/                      # Inline completions
│   ├── completionProvider.ts       # Ghost text provider
│   ├── completionCache.ts          # Completion caching
│   └── debouncer.ts                # Request debouncing
│
├── chat/                            # Chat interface
│   ├── chatService.ts              # Chat orchestration
│   ├── conversationManager.ts      # Conversation state
│   ├── messageProcessor.ts         # Message handling
│   └── modeManager.ts              # AI mode switching
│
├── refactoring/                     # Code refactoring
│   ├── refactoringEngine.ts        # Refactoring orchestration
│   ├── changePreview.ts            # Diff preview generation
│   └── parsers/
│       └── codeParser.ts
│
├── debug/                           # AI debugging
│   ├── debugAssistant.ts           # Debug helper
│   ├── errorAnalyzer.ts            # Error analysis
│   └── breakpointSuggester.ts      # Smart breakpoints
│
├── search/                          # Semantic search
│   ├── semanticSearch.ts           # Search engine
│   ├── queryProcessor.ts           # Query understanding
│   └── resultRanker.ts             # Result ranking
│
└── extension-api/                   # Extension integration
    ├── aiExtensionApi.ts           # Public API
    └── contributionPoints.ts       # Extension points
```

---

## 3. Phase 1: Foundation (Months 1-3)

### 3.1 Goals
- Establish AI integration infrastructure
- Implement single provider support (OpenAI)
- Build basic inline completion (ghost text)
- Create configuration system

### 3.2 Week-by-Week Breakdown

#### Week 1-2: Project Setup & Infrastructure

**Tasks:**
```typescript
// 1. Create AI module structure
// src/vs/ai/common/types/ai.types.ts

export interface AIRequestContext {
    userId?: string;
    query: string;
    contextData?: CodeContext;
    mode: AIMode;
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

export interface AIResponse {
    content: string;
    tokensUsed: number;
    provider: string;
    model: string;
    latency: number;
    finishReason: string;
    metadata?: Record<string, any>;
}

export type AIMode = 'coding' | 'architect' | 'debug' | 'learning';

export interface CodeContext {
    currentFile?: FileContext;
    openFiles?: FileContext[];
    recentEdits?: EditContext[];
    projectStructure?: ProjectContext;
    selection?: SelectionContext;
}

export interface FileContext {
    path: string;
    content: string;
    language: string;
    cursorPosition?: Position;
}
```

**Deliverables:**
- [ ] AI module folder structure
- [ ] Core TypeScript type definitions
- [ ] Build configuration updates
- [ ] Development environment setup

#### Week 3-4: Provider Abstraction Layer

**Implementation:**
```typescript
// src/vs/ai/provider/common/aiProvider.ts

export interface IAIProvider {
    readonly id: string;
    readonly name: string;
    readonly capabilities: ProviderCapabilities;
    
    initialize(config: ProviderConfig): Promise<void>;
    sendRequest(context: AIRequestContext): Promise<AIResponse>;
    streamRequest(context: AIRequestContext): AsyncIterable<AIResponseChunk>;
    getAvailableModels(): Promise<string[]>;
    validateConfig(): Promise<boolean>;
    shutdown(): Promise<void>;
}

export interface ProviderCapabilities {
    supportsStreaming: boolean;
    supportsSystemMessages: boolean;
    supportsFunctionCalling: boolean;
    maxContextLength: number;
    supportedModes: AIMode[];
}

// src/vs/ai/provider/openai/openaiProvider.ts
export class OpenAIProvider implements IAIProvider {
    readonly id = 'openai';
    readonly name = 'OpenAI';
    readonly capabilities: ProviderCapabilities = {
        supportsStreaming: true,
        supportsSystemMessages: true,
        supportsFunctionCalling: true,
        maxContextLength: 128000,
        supportedModes: ['coding', 'architect', 'debug', 'learning']
    };
    
    private client: OpenAI;
    private config: ProviderConfig;
    
    async initialize(config: ProviderConfig): Promise<void> {
        this.config = config;
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.endpoint
        });
    }
    
    async sendRequest(context: AIRequestContext): Promise<AIResponse> {
        const startTime = Date.now();
        
        const response = await this.client.chat.completions.create({
            model: context.model || this.config.defaultModel || 'gpt-4o',
            messages: this.buildMessages(context),
            temperature: context.temperature ?? 0.1,
            max_tokens: context.maxTokens
        });
        
        return {
            content: response.choices[0].message.content || '',
            tokensUsed: response.usage?.total_tokens || 0,
            provider: this.id,
            model: response.model,
            latency: Date.now() - startTime,
            finishReason: response.choices[0].finish_reason
        };
    }
    
    async *streamRequest(context: AIRequestContext): AsyncIterable<AIResponseChunk> {
        const stream = await this.client.chat.completions.create({
            model: context.model || this.config.defaultModel || 'gpt-4o',
            messages: this.buildMessages(context),
            temperature: context.temperature ?? 0.1,
            max_tokens: context.maxTokens,
            stream: true
        });
        
        for await (const chunk of stream) {
            yield {
                content: chunk.choices[0]?.delta?.content || '',
                isComplete: false
            };
        }
        
        yield { content: '', isComplete: true };
    }
}
```

**Deliverables:**
- [ ] Base provider interface
- [ ] OpenAI provider implementation
- [ ] Provider registry system
- [ ] Configuration management

#### Week 5-6: Context Manager

**Implementation:**
```typescript
// src/vs/ai/context/contextManager.ts

export interface IContextManager {
    gatherContext(options?: ContextOptions): Promise<CodeContext>;
    updateContext(change: ContextChange): void;
    getCurrentFileContext(): FileContext | undefined;
    getOpenFilesContext(): FileContext[];
    getRecentEdits(): EditContext[];
}

export class ContextManager extends Disposable implements IContextManager {
    private readonly _onContextChanged = this._register(new Emitter<ContextChange>());
    readonly onContextChanged = this._onContextChanged.event;
    
    constructor(
        @IEditorService private readonly editorService: IEditorService,
        @IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
        @IFileService private readonly fileService: IFileService
    ) {
        super();
        this.registerListeners();
    }
    
    async gatherContext(options: ContextOptions = {}): Promise<CodeContext> {
        const [currentFile, openFiles, recentEdits] = await Promise.all([
            this.getCurrentFileContext(),
            options.includeOpenFiles !== false ? this.getOpenFilesContext() : [],
            options.includeRecentEdits !== false ? this.getRecentEdits() : []
        ]);
        
        return {
            currentFile,
            openFiles: openFiles.filter(f => f.path !== currentFile?.path),
            recentEdits,
            projectStructure: options.includeProjectStructure ? await this.getProjectStructure() : undefined
        };
    }
    
    private registerListeners(): void {
        // Track file changes
        this._register(this.editorService.onDidActiveEditorChange(() => {
            this._onContextChanged.fire({ type: 'activeEditorChanged' });
        }));
        
        // Track text changes
        this._register(this.fileService.onDidFilesChange(e => {
            this._onContextChanged.fire({ type: 'filesChanged', changes: e.changes });
        }));
    }
}
```

**Deliverables:**
- [ ] Context gathering system
- [ ] File change tracking
- [ ] Editor state integration
- [ ] Token budget management

#### Week 7-8: Inline Completion (Ghost Text)

**Implementation:**
```typescript
// src/vs/ai/completion/completionProvider.ts

export interface IAICompletionProvider {
    provideInlineCompletions(
        model: ITextModel,
        position: Position,
        context: InlineCompletionContext,
        token: CancellationToken
    ): Promise<InlineCompletions<InlineCompletion>>;
}

export class AICompletionProvider implements IAICompletionProvider {
    private readonly cache = new CompletionCache();
    private readonly debouncer = new Debouncer(50); // 50ms debounce
    
    constructor(
        @IAIService private readonly aiService: IAIService,
        @IContextManager private readonly contextManager: IContextManager,
        @ILogService private readonly logService: ILogService
    ) {}
    
    async provideInlineCompletions(
        model: ITextModel,
        position: Position,
        context: InlineCompletionContext,
        token: CancellationToken
    ): Promise<InlineCompletions<InlineCompletion>> {
        // Debounce rapid keystrokes
        await this.debouncer.wait();
        
        if (token.isCancellationRequested) {
            return { items: [] };
        }
        
        // Check cache
        const cacheKey = this.generateCacheKey(model, position);
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return { items: [cached] };
        }
        
        try {
            const codeContext = await this.contextManager.gatherContext({
                maxTokens: 2000,
                includeOpenFiles: true,
                includeRecentEdits: true
            });
            
            const prompt = this.buildCompletionPrompt(model, position, codeContext);
            
            const response = await this.aiService.sendRequest({
                query: prompt,
                contextData: codeContext,
                mode: 'coding',
                maxTokens: 100,
                temperature: 0.1
            });
            
            const completion: InlineCompletion = {
                insertText: response.content,
                range: new Range(position.lineNumber, position.column, position.lineNumber, position.column),
                command: {
                    id: 'ai.completion.accepted',
                    title: 'AI Completion Accepted',
                    arguments: [response]
                }
            };
            
            // Cache the result
            this.cache.set(cacheKey, completion, 30000); // 30s TTL
            
            return { items: [completion] };
            
        } catch (error) {
            this.logService.error('AI completion error:', error);
            return { items: [] };
        }
    }
    
    private buildCompletionPrompt(
        model: ITextModel,
        position: Position,
        context: CodeContext
    ): string {
        const currentLine = model.getLineContent(position.lineNumber);
        const prefix = model.getValueInRange(new Range(1, 1, position.lineNumber, position.column));
        
        return `<|file:${context.currentFile?.path}|>
${context.openFiles?.map(f => `<|file:${f.path}|>\n${f.content}`).join('\n') || ''}

Complete the code at the cursor position:
${prefix}<|cursor|>`;
    }
}
```

**Deliverables:**
- [ ] Inline completion provider
- [ ] Debouncing and caching
- [ ] VS Code inline completions integration
- [ ] Acceptance/rejection tracking

#### Week 9-10: Configuration System

**Implementation:**
```typescript
// src/vs/ai/common/configuration.ts

export const aiConfiguration = {
    // Provider settings
    'ai.provider.default': {
        type: 'string',
        default: 'openai',
        enum: ['openai', 'anthropic', 'google', 'aws', 'openrouter', 'ollama'],
        description: 'Default AI provider'
    },
    'ai.provider.openai.apiKey': {
        type: 'string',
        default: '',
        description: 'OpenAI API Key'
    },
    'ai.provider.openai.model': {
        type: 'string',
        default: 'gpt-4o',
        enum: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
        description: 'OpenAI model to use'
    },
    
    // Inline completion settings
    'ai.completion.enabled': {
        type: 'boolean',
        default: true,
        description: 'Enable AI inline completions'
    },
    'ai.completion.delay': {
        type: 'number',
        default: 50,
        minimum: 0,
        maximum: 1000,
        description: 'Delay before requesting completions (ms)'
    },
    'ai.completion.maxTokens': {
        type: 'number',
        default: 100,
        description: 'Maximum tokens per completion'
    },
    
    // Privacy settings
    'ai.privacy.sendCodeToAI': {
        type: 'boolean',
        default: true,
        description: 'Allow sending code to AI providers'
    },
    'ai.privacy.anonymousTelemetry': {
        type: 'boolean',
        default: false,
        description: 'Share anonymous usage data'
    }
};
```

**Deliverables:**
- [ ] Configuration schema
- [ ] Settings UI integration
- [ ] Secure API key storage
- [ ] Configuration validation

#### Week 11-12: Testing & Integration

**Deliverables:**
- [ ] Unit tests for all Phase 1 components
- [ ] Integration tests with mock providers
- [ ] Performance benchmarks
- [ ] Documentation

### 3.3 Phase 1 Success Criteria
- [x] Basic inline completion working with OpenAI
- [x] Configuration system functional
- [x] All tests passing
- [x] Performance within targets

---

## 4. Phase 2: Core AI Features (Months 4-6)

### 4.1 Goals
- Multi-provider support
- Chat interface for refactoring
- Local model integration
- Context indexing foundation

### 4.2 Week-by-Week Breakdown

#### Week 13-14: Multi-Provider Support

**Implementation:**
```typescript
// src/vs/ai/provider/anthropic/anthropicProvider.ts
export class AnthropicProvider implements IAIProvider {
    readonly id = 'anthropic';
    readonly name = 'Anthropic Claude';
    readonly capabilities = {
        supportsStreaming: true,
        supportsSystemMessages: true,
        supportsFunctionCalling: false,
        maxContextLength: 200000,
        supportedModes: ['coding', 'architect', 'debug', 'learning']
    };
    
    private client: Anthropic;
    
    async sendRequest(context: AIRequestContext): Promise<AIResponse> {
        const response = await this.client.messages.create({
            model: context.model || 'claude-3-5-sonnet-20241022',
            max_tokens: context.maxTokens || 4096,
            messages: this.buildMessages(context),
            system: this.getSystemPrompt(context.mode)
        });
        
        return {
            content: response.content[0].type === 'text' 
                ? response.content[0].text 
                : '',
            tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
            provider: this.id,
            model: response.model,
            latency: 0,
            finishReason: response.stop_reason || 'stop'
        };
    }
}

// src/vs/ai/provider/local/ollamaProvider.ts
export class OllamaProvider implements IAIProvider {
    readonly id = 'ollama';
    readonly name = 'Ollama (Local)';
    readonly capabilities = {
        supportsStreaming: true,
        supportsSystemMessages: true,
        supportsFunctionCalling: false,
        maxContextLength: 8192,
        supportedModes: ['coding', 'learning']
    };
    
    async sendRequest(context: AIRequestContext): Promise<AIResponse> {
        const response = await fetch(`${this.config.endpoint}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: context.model || 'codellama',
                prompt: context.query,
                stream: false,
                options: {
                    temperature: context.temperature ?? 0.1
                }
            })
        });
        
        const data = await response.json();
        return {
            content: data.response,
            tokensUsed: data.eval_count || 0,
            provider: this.id,
            model: context.model || 'codellama',
            latency: 0,
            finishReason: 'stop'
        };
    }
}
```

**Deliverables:**
- [ ] Anthropic provider
- [ ] Google provider (Gemini)
- [ ] AWS Bedrock provider
- [ ] OpenRouter provider
- [ ] Ollama local provider
- [ ] Provider switching UI

#### Week 15-16: Chat Interface

**Implementation:**
```typescript
// src/vs/ai/chat/chatService.ts

export interface IChatService {
    createConversation(mode: AIMode): Promise<IConversation>;
    sendMessage(conversationId: string, content: string): Promise<void>;
    getConversation(id: string): IConversation | undefined;
    deleteConversation(id: string): void;
    onMessageReceived: Event<{ conversationId: string; message: IMessage }>;
}

export class ChatService implements IChatService {
    private conversations = new Map<string, IConversation>();
    private readonly _onMessageReceived = new Emitter<{ conversationId: string; message: IMessage }>();
    readonly onMessageReceived = this._onMessageReceived.event;
    
    constructor(
        @IAIService private readonly aiService: IAIService,
        @IContextManager private readonly contextManager: IContextManager,
        @IConversationStorage private readonly storage: IConversationStorage
    ) {}
    
    async createConversation(mode: AIMode): Promise<IConversation> {
        const conversation: IConversation = {
            id: generateUuid(),
            mode,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        // Add system message based on mode
        conversation.messages.push({
            id: generateUuid(),
            role: 'system',
            content: this.getSystemPromptForMode(mode),
            timestamp: Date.now()
        });
        
        this.conversations.set(conversation.id, conversation);
        return conversation;
    }
    
    async sendMessage(conversationId: string, content: string): Promise<void> {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }
        
        // Add user message
        const userMessage: IMessage = {
            id: generateUuid(),
            role: 'user',
            content,
            timestamp: Date.now()
        };
        conversation.messages.push(userMessage);
        
        // Gather context
        const context = await this.contextManager.gatherContext({
            maxTokens: 4000,
            includeOpenFiles: true,
            includeRecentEdits: true
        });
        
        // Build messages for AI
        const messages = conversation.messages.map(m => ({
            role: m.role,
            content: m.content
        }));
        
        // Stream response
        const response = await this.aiService.streamRequest({
            query: content,
            contextData: context,
            mode: conversation.mode
        });
        
        let fullContent = '';
        for await (const chunk of response) {
            fullContent += chunk.content;
            
            if (chunk.isComplete) {
                const assistantMessage: IMessage = {
                    id: generateUuid(),
                    role: 'assistant',
                    content: fullContent,
                    timestamp: Date.now()
                };
                conversation.messages.push(assistantMessage);
                this._onMessageReceived.fire({ conversationId, message: assistantMessage });
            }
        }
        
        // Save conversation
        await this.storage.saveConversation(conversation);
    }
    
    private getSystemPromptForMode(mode: AIMode): string {
        const prompts: Record<AIMode, string> = {
            coding: `You are an expert coding assistant. Help with code completion, explanation, and suggestions.
Always provide clean, well-documented code. Use markdown code blocks with language identifiers.`,
            
            architect: `You are a software architect. Help design systems, review architecture decisions,
and suggest best practices. Focus on scalability, maintainability, and design patterns.`,
            
            debug: `You are a debugging expert. Analyze code, identify bugs, and suggest fixes.
Explain the root cause and provide corrected code.`,
            
            learning: `You are a patient teacher. Explain concepts clearly, provide examples,
and help the user understand code and programming concepts.`
        };
        
        return prompts[mode];
    }
}
```

**Deliverables:**
- [ ] Chat service
- [ ] Conversation management
- [ ] Message streaming
- [ ] UI integration (React components)

#### Week 17-18: Natural Language Refactoring

**Implementation:**
```typescript
// src/vs/ai/refactoring/refactoringEngine.ts

export interface IRefactoringEngine {
    processRequest(request: RefactoringRequest): Promise<RefactoringResult>;
    previewChanges(changes: CodeChange[]): Promise<ChangePreview>;
    applyChanges(changes: CodeChange[]): Promise<void>;
}

export interface RefactoringRequest {
    instruction: string;
    targetFiles: string[];
    selection?: Range;
}

export interface RefactoringResult {
    changes: CodeChange[];
    explanation: string;
    estimatedImpact: ImpactAnalysis;
}

export class RefactoringEngine implements IRefactoringEngine {
    constructor(
        @IAIService private readonly aiService: IAIService,
        @IContextManager private readonly contextManager: IContextManager,
        @IBulkEditService private readonly bulkEditService: IBulkEditService,
        @IDialogService private readonly dialogService: IDialogService
    ) {}
    
    async processRequest(request: RefactoringRequest): Promise<RefactoringResult> {
        const context = await this.contextManager.gatherContext({
            maxTokens: 8000,
            includeProjectStructure: true,
            targetFiles: request.targetFiles
        });
        
        const prompt = this.buildRefactoringPrompt(request, context);
        
        const response = await this.aiService.sendRequest({
            query: prompt,
            contextData: context,
            mode: 'coding',
            temperature: 0.2
        });
        
        const changes = this.parseChanges(response.content, request.targetFiles);
        
        return {
            changes,
            explanation: this.extractExplanation(response.content),
            estimatedImpact: this.analyzeImpact(changes)
        };
    }
    
    private buildRefactoringPrompt(request: RefactoringRequest, context: CodeContext): string {
        return `You are an expert code refactoring assistant. Given the following code and instruction,
generate the refactored code with clear change descriptions.

## User Instruction
${request.instruction}

## Target Files
${request.targetFiles.join('\n')}

## Current Code Context
${context.currentFile?.content || ''}

## Response Format
Provide your response in this format:

EXPLANATION: <brief explanation of changes>

CHANGES:
FILE: <file path>
LANGUAGE: <language>
\`\`\`<language>
<complete new file content>
\`\`\`

END`;
    }
    
    async previewChanges(changes: CodeChange[]): Promise<ChangePreview> {
        const previews: FilePreview[] = [];
        
        for (const change of changes) {
            const model = await this.getModel(change.filePath);
            if (model) {
                const original = model.getValue();
                const modified = change.newContent;
                
                previews.push({
                    filePath: change.filePath,
                    original,
                    modified,
                    diff: await this.computeDiff(original, modified)
                });
            }
        }
        
        return { previews };
    }
    
    async applyChanges(changes: CodeChange[]): Promise<void> {
        const edits: ResourceTextEdit[] = changes.map(change => ({
            resource: URI.file(change.filePath),
            textEdit: {
                range: new Range(1, 1, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
                text: change.newContent
            }
        }));
        
        await this.bulkEditService.apply({ edits });
    }
}
```

**Deliverables:**
- [ ] Refactoring engine
- [ ] Change preview/diff UI
- [ ] Apply/rollback functionality
- [ ] Multi-file refactoring support

#### Week 19-20: Context Indexing Foundation

**Implementation:**
```typescript
// src/vs/ai/indexing/indexManager.ts

export interface IIndexManager {
    initialize(workspaceRoot: string): Promise<void>;
    indexFile(filePath: string): Promise<void>;
    indexWorkspace(): Promise<void>;
    search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    semanticSearch(query: string): Promise<SearchResult[]>;
}

export class IndexManager implements IIndexManager {
    private semanticIndex: SemanticIndex;
    private keywordIndex: KeywordIndex;
    private fileWatcher: IDisposable;
    
    constructor(
        @IFileService private readonly fileService: IFileService,
        @ILogService private readonly logService: ILogService,
        @IStorageService private readonly storageService: IStorageService
    ) {}
    
    async initialize(workspaceRoot: string): Promise<void> {
        this.semanticIndex = new SemanticIndex();
        this.keywordIndex = new KeywordIndex();
        
        // Load existing index if available
        await this.loadIndex();
        
        // Setup file watching
        this.fileWatcher = this.fileService.watch(URI.file(workspaceRoot));
        this._register(this.fileService.onDidFilesChange(e => {
            this.handleFileChanges(e);
        }));
    }
    
    async indexFile(filePath: string): Promise<void> {
        try {
            const content = await this.fileService.readFile(URI.file(filePath));
            const text = content.value.toString();
            
            // Extract semantic information
            const semanticChunks = await this.extractSemanticChunks(filePath, text);
            
            // Add to indexes
            await Promise.all([
                this.semanticIndex.addDocument(filePath, semanticChunks),
                this.keywordIndex.addDocument(filePath, text)
            ]);
            
            this.logService.debug(`Indexed: ${filePath}`);
        } catch (error) {
            this.logService.error(`Failed to index ${filePath}:`, error);
        }
    }
    
    async semanticSearch(query: string): Promise<SearchResult[]> {
        // Generate query embedding (using local model or service)
        const queryEmbedding = await this.generateEmbedding(query);
        
        // Search semantic index
        const results = await this.semanticIndex.search(queryEmbedding, 10);
        
        return results.map(r => ({
            filePath: r.filePath,
            score: r.score,
            snippets: r.chunks.map(c => ({
                content: c.content,
                lineStart: c.lineStart,
                lineEnd: c.lineEnd
            }))
        }));
    }
    
    private async extractSemanticChunks(filePath: string, content: string): Promise<SemanticChunk[]> {
        const language = this.detectLanguage(filePath);
        const parser = this.getParser(language);
        
        return parser.parse(content);
    }
}

// Semantic index using vector embeddings
class SemanticIndex {
    private documents = new Map<string, SemanticDocument>();
    private embeddings: Float32Array[] = [];
    
    async addDocument(filePath: string, chunks: SemanticChunk[]): Promise<void> {
        // Generate embeddings for chunks
        const chunkEmbeddings = await Promise.all(
            chunks.map(c => this.generateEmbedding(c.content))
        );
        
        this.documents.set(filePath, {
            path: filePath,
            chunks,
            embeddings: chunkEmbeddings
        });
    }
    
    async search(queryEmbedding: Float32Array, topK: number): Promise<SemanticResult[]> {
        const scores: SemanticResult[] = [];
        
        for (const [path, doc] of this.documents) {
            for (let i = 0; i < doc.embeddings.length; i++) {
                const similarity = this.cosineSimilarity(queryEmbedding, doc.embeddings[i]);
                scores.push({
                    filePath: path,
                    chunkIndex: i,
                    score: similarity,
                    chunks: [doc.chunks[i]]
                });
            }
        }
        
        return scores
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }
    
    private cosineSimilarity(a: Float32Array, b: Float32Array): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
```

**Deliverables:**
- [ ] Index manager
- [ ] Semantic index
- [ ] Keyword index
- [ ] File watching for incremental updates
- [ ] Search API

#### Week 21-22: Local Model Integration

**Deliverables:**
- [ ] Ollama integration complete
- [ ] LM Studio integration
- [ ] Local model management UI
- [ ] Hardware requirement detection

#### Week 23-24: Testing & Documentation

**Deliverables:**
- [ ] Multi-provider test suite
- [ ] Chat interface tests
- [ ] Refactoring engine tests
- [ ] Performance benchmarks
- [ ] User documentation

### 4.3 Phase 2 Success Criteria
- [x] 5+ providers supported
- [x] Chat interface functional
- [x] Refactoring with preview working
- [x] Basic indexing operational

---

## 5. Phase 3: Advanced Features (Months 7-9)

### 5.1 Goals
- Semantic code search
- AI debugging assistant
- Multi-mode AI interactions
- Extension API for AI

### 5.2 Week-by-Week Breakdown

#### Week 25-26: Advanced Semantic Search

**Implementation:**
```typescript
// src/vs/ai/search/semanticSearch.ts

export interface ISemanticSearch {
    search(query: string, options: SearchOptions): Promise<SearchResult[]>;
    findSimilarCode(codeSnippet: string): Promise<SearchResult[]>;
    findReferences(symbol: string): Promise<SearchResult[]>;
    naturalLanguageQuery(query: string): Promise<SearchResult[]>;
}

export class SemanticSearchService implements ISemanticSearch {
    constructor(
        @IIndexManager private readonly indexManager: IIndexManager,
        @IAIService private readonly aiService: IAIService
    ) {}
    
    async naturalLanguageQuery(query: string): Promise<SearchResult[]> {
        // Use AI to understand the query intent
        const intent = await this.aiService.sendRequest({
            query: `Analyze this search query and extract key technical terms and intent:
"${query}"

Respond with:
INTENT: <what the user is looking for>
KEYWORDS: <comma-separated technical keywords>
LANGUAGE: <programming language if specified>
FILE_TYPE: <file extension if relevant>`,
            mode: 'coding',
            maxTokens: 200
        });
        
        // Parse intent and perform targeted search
        const parsed = this.parseIntent(intent.content);
        
        // Combine semantic and keyword search
        const [semanticResults, keywordResults] = await Promise.all([
            this.indexManager.semanticSearch(parsed.keywords.join(' ')),
            this.indexManager.keywordSearch(parsed.keywords)
        ]);
        
        // Merge and rank results
        return this.mergeResults(semanticResults, keywordResults, parsed);
    }
    
    async findSimilarCode(codeSnippet: string): Promise<SearchResult[]> {
        // Generate embedding for the code snippet
        const embedding = await this.generateCodeEmbedding(codeSnippet);
        
        // Find similar code in the index
        return this.indexManager.semanticSearchByVector(embedding);
    }
}
```

**Deliverables:**
- [ ] Natural language search
- [ ] Similar code finder
- [ ] Cross-reference search
- [ ] Search results ranking

#### Week 27-28: AI Debugging Assistant

**Implementation:**
```typescript
// src/vs/ai/debug/debugAssistant.ts

export interface IDebugAssistant {
    analyzeError(error: ErrorInfo): Promise<ErrorAnalysis>;
    suggestBreakpoint(location: DebugLocation): Promise<BreakpointSuggestion[]>;
    explainStackTrace(stackTrace: string): Promise<StackTraceExplanation>;
    suggestFix(error: ErrorInfo, context: DebugContext): Promise<FixSuggestion>;
}

export class DebugAssistant implements IDebugAssistant {
    constructor(
        @IAIService private readonly aiService: IAIService,
        @IContextManager private readonly contextManager: IContextManager,
        @IDebugService private readonly debugService: IDebugService
    ) {}
    
    async analyzeError(error: ErrorInfo): Promise<ErrorAnalysis> {
        const context = await this.gatherDebugContext(error);
        
        const response = await this.aiService.sendRequest({
            query: `Analyze this error and provide insights:

Error: ${error.message}
Stack Trace:
${error.stackTrace}
Location: ${error.filePath}:${error.lineNumber}

## Code Context
${context.codeSnippet}

## Variables in Scope
${JSON.stringify(context.variables, null, 2)}

Provide:
1. Root cause analysis
2. Likely fix
3. Prevention tips`,
            mode: 'debug',
            contextData: context,
            maxTokens: 1000
        });
        
        return this.parseErrorAnalysis(response.content);
    }
    
    async suggestFix(error: ErrorInfo, context: DebugContext): Promise<FixSuggestion> {
        const response = await this.aiService.sendRequest({
            query: `Given this error, suggest a code fix:

Error: ${error.message}
Current Code:
${context.codeSnippet}

Provide the fixed code with explanation.`,
            mode: 'debug',
            maxTokens: 800
        });
        
        return {
            explanation: this.extractExplanation(response.content),
            fixedCode: this.extractCode(response.content),
            confidence: 0.85
        };
    }
    
    async suggestBreakpoint(location: DebugLocation): Promise<BreakpointSuggestion[]> {
        const context = await this.getFunctionContext(location);
        
        const response = await this.aiService.sendRequest({
            query: `Analyze this code and suggest strategic breakpoint locations:

${context.functionCode}

Suggest breakpoints at:
1. Before potential null references
2. Before complex conditionals
3. At loop entry points
4. Before error-prone operations

Return as JSON array with line numbers and reasons.`,
            mode: 'debug',
            maxTokens: 500
        });
        
        return JSON.parse(response.content);
    }
}
```

**Deliverables:**
- [ ] Error analysis
- [ ] Stack trace explanation
- [ ] Fix suggestions
- [ ] Smart breakpoint suggestions
- [ ] Debug panel integration

#### Week 29-30: Multi-Mode AI

**Implementation:**
```typescript
// src/vs/ai/chat/modeManager.ts

export interface IModeManager {
    switchMode(conversationId: string, mode: AIMode): void;
    getModeConfig(mode: AIMode): ModeConfig;
    getAvailableModes(): AIMode[];
}

export interface ModeConfig {
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    contextWindow: number;
    tools: ToolDefinition[];
    responseFormat: 'text' | 'code' | 'structured';
}

export class ModeManager implements IModeManager {
    private modeConfigs: Map<AIMode, ModeConfig> = new Map([
        ['coding', {
            systemPrompt: `You are an expert coding assistant...`,
            temperature: 0.1,
            maxTokens: 2000,
            contextWindow: 4000,
            tools: [completionTool, explanationTool, refactorTool],
            responseFormat: 'code'
        }],
        ['architect', {
            systemPrompt: `You are a software architect...`,
            temperature: 0.3,
            maxTokens: 4000,
            contextWindow: 8000,
            tools: [designTool, reviewTool, patternTool],
            responseFormat: 'structured'
        }],
        ['debug', {
            systemPrompt: `You are a debugging expert...`,
            temperature: 0.1,
            maxTokens: 3000,
            contextWindow: 6000,
            tools: [analyzeTool, fixTool, explainTool],
            responseFormat: 'structured'
        }],
        ['learning', {
            systemPrompt: `You are a patient programming teacher...`,
            temperature: 0.5,
            maxTokens: 4000,
            contextWindow: 4000,
            tools: [explainTool, exampleTool, quizTool],
            responseFormat: 'text'
        }]
    ]);
    
    getModeConfig(mode: AIMode): ModeConfig {
        return this.modeConfigs.get(mode)!;
    }
    
    switchMode(conversationId: string, mode: AIMode): void {
        const config = this.getModeConfig(mode);
        
        // Update conversation with new mode settings
        this.chatService.updateConversationMode(conversationId, mode, config);
        
        // Add mode switch message
        this.chatService.addSystemMessage(
            conversationId,
            `Switched to ${mode} mode. ${config.systemPrompt}`
        );
    }
}
```

**Deliverables:**
- [ ] Mode configuration system
- [ ] Mode-specific prompts
- [ ] Mode switching UI
- [ ] Tool integration per mode

#### Week 31-32: Extension API

**Implementation:**
```typescript
// src/vs/ai/extension-api/aiExtensionApi.ts

export interface AIExtensionAPI {
    // Register a custom AI provider
    registerProvider(id: string, provider: IAIProvider): IDisposable;
    
    // Hook into AI requests
    onWillSendRequest: Event<AIRequestContext>;
    onDidReceiveResponse: Event<AIResponse>;
    
    // Register AI-powered commands
    registerAICommand(
        id: string,
        handler: (context: AICommandContext) => Promise<AICommandResult>
    ): IDisposable;
    
    // Access AI features
    getCompletionProvider(): IAICompletionProvider;
    getChatService(): IChatService;
    getContextManager(): IContextManager;
    
    // Custom context providers
    registerContextProvider(provider: ContextProvider): IDisposable;
}

export interface AICommandContext {
    editor: ICodeEditor;
    selection: Selection;
    context: CodeContext;
    args: any[];
}

// Example extension usage
export function activate(context: vscode.ExtensionContext, aiApi: AIExtensionAPI) {
    // Register a custom context provider
    aiApi.registerContextProvider({
        id: 'myExtension',
        async provideContext(): Promise<ContextContribution> {
            return {
                customData: await getCustomData(),
                priority: 10
            };
        }
    });
    
    // Register an AI command
    aiApi.registerAICommand('myExtension.customRefactor', async (ctx) => {
        const response = await aiApi.getChatService().sendMessage(
            ctx.context,
            `Custom refactor for: ${ctx.selection.toString()}`
        );
        
        return {
            edits: parseEdits(response),
            label: 'Custom AI Refactor'
        };
    });
}
```

**Deliverables:**
- [ ] Extension API surface
- [ ] Context provider API
- [ ] AI command registration
- [ ] Event hooks
- [ ] Sample extension

#### Week 33-34: Codebase Indexing Optimization

**Deliverables:**
- [ ] Incremental indexing
- [ ] Background indexing
- [ ] Index persistence
- [ ] Large codebase optimization

#### Week 35-36: Testing & Performance

**Deliverables:**
- [ ] End-to-end tests
- [ ] Performance optimization
- [ ] Load testing
- [ ] Memory profiling

### 5.3 Phase 3 Success Criteria
- [x] Semantic search operational
- [x] Debugging assistant functional
- [x] All AI modes working
- [x] Extension API stable

---

## 6. Phase 4: Polish & Ecosystem (Months 10-12)

### 6.1 Goals
- Performance optimization
- UI/UX refinement
- Documentation
- Beta release

### 6.2 Week-by-Week Breakdown

#### Week 37-38: Performance Optimization

**Tasks:**
- Optimize AI request caching
- Implement request batching
- Reduce memory footprint
- Optimize indexing speed
- Lazy loading of AI components

**Deliverables:**
- [ ] < 200ms inline completion latency
- [ ] < 10% memory overhead
- [ ] Fast indexing (< 1 min for large projects)

#### Week 39-40: UI/UX Refinement

**Deliverables:**
- [ ] Polished chat interface
- [ ] Improved ghost text rendering
- [ ] Better error handling UI
- [ ] Settings wizards
- [ ] Onboarding flow

#### Week 41-42: Documentation

**Deliverables:**
- [ ] User documentation
- [ ] API documentation
- [ ] Extension development guide
- [ ] Troubleshooting guide
- [ ] Video tutorials

#### Week 43-44: Beta Release

**Deliverables:**
- [ ] Beta release builds
- [ ] Feedback collection system
- [ ] Issue tracking
- [ ] Community support channels

#### Week 45-46: Bug Fixes & Stabilization

**Deliverables:**
- [ ] Critical bug fixes
- [ ] Stability improvements
- [ ] Edge case handling
- [ ] Cross-platform testing

#### Week 47-48: Final Release Preparation

**Deliverables:**
- [ ] Release candidate
- [ ] Final documentation
- [ ] Release notes
- [ ] Marketing materials

### 6.3 Phase 4 Success Criteria
- [x] Stable beta release
- [x] All performance targets met
- [x] Complete documentation
- [x] Community feedback addressed

---

## 7. Backend Services Detailed Design

### 7.1 Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    API Gateway                            │   │
│  │  (Request routing, rate limiting, authentication)         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────┐      │
│  │                           │                           │      │
│  ▼                           ▼                           ▼      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   AI Core   │    │   Context   │    │    Chat     │          │
│  │   Service   │    │   Service   │    │   Service   │          │
│  │             │    │             │    │             │          │
│  │ • Provider  │    │ • File      │    │ • Conversa- │          │
│  │   routing   │    │   tracking  │    │   tions     │          │
│  │ • Request   │    │ • Context   │    │ • Messages  │          │
│  │   queue     │    │   building  │    │ • History   │          │
│  │ • Caching   │    │ • Token     │    │             │          │
│  │ • Fallback  │    │   budgeting │    │             │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│         │                  │                  │                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │ Completion  │    │  Indexing   │    │  Refactor   │          │
│  │   Service   │    │   Service   │    │   Service   │          │
│  │             │    │             │    │             │          │
│  │ • Ghost     │    │ • Semantic  │    │ • NL parsing│          │
│  │   text      │    │   indexing  │    │ • Change    │          │
│  │ • Debounce  │    │ • Keyword   │    │   preview   │          │
│  │ • Cache     │    │   index     │    │ • Diff      │          │
│  │             │    │ • Search    │    │   gen       │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│         │                  │                  │                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   Debug     │    │   Search    │    │ Extension   │          │
│  │   Service   │    │   Service   │    │   Service   │          │
│  │             │    │             │    │             │          │
│  │ • Error     │    │ • Semantic  │    │ • API       │          │
│  │   analysis  │    │   search    │    │   gateway   │          │
│  │ • Fix       │    │ • NL        │    │ • Hooks     │          │
│  │   suggest   │    │   queries   │    │ • Events    │          │
│  │ • Breakpoint│    │ • Ranking   │    │             │          │
│  │   suggest   │    │             │    │             │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Service Interfaces

```typescript
// Core service interfaces

interface IAIService {
    sendRequest(context: AIRequestContext): Promise<AIResponse>;
    streamRequest(context: AIRequestContext): AsyncIterable<AIResponseChunk>;
    getProvider(id: string): IAIProvider;
    switchProvider(providerId: string): void;
    estimateTokens(text: string): number;
}

interface IContextService {
    getCurrentContext(options?: ContextOptions): Promise<CodeContext>;
    subscribeToChanges(callback: (change: ContextChange) => void): IDisposable;
    getTokenBudget(context: CodeContext): number;
    prioritizeContext(context: CodeContext, priority: ContextPriority): CodeContext;
}

interface IChatService {
    createConversation(options: ConversationOptions): Promise<IConversation>;
    sendMessage(conversationId: string, message: string): Promise<void>;
    getHistory(conversationId: string): IMessage[];
    deleteConversation(conversationId: string): void;
    exportConversation(conversationId: string): string;
}

interface ICompletionService {
    getCompletions(params: CompletionParams): Promise<CompletionItem[]>;
    acceptCompletion(item: CompletionItem): void;
    rejectCompletion(item: CompletionItem): void;
    getStats(): CompletionStats;
}

interface IIndexingService {
    indexWorkspace(): Promise<void>;
    indexFile(filePath: string): Promise<void>;
    search(query: string): Promise<SearchResult[]>;
    semanticSearch(query: string): Promise<SearchResult[]>;
    getIndexStatus(): IndexStatus;
}

interface IRefactorService {
    analyze(request: RefactorRequest): Promise<RefactorAnalysis>;
    preview(changes: CodeChange[]): Promise<ChangePreview>;
    apply(changes: CodeChange[]): Promise<void>;
    rollback(changes: CodeChange[]): Promise<void>;
}

interface IDebugService {
    analyzeError(error: ErrorInfo): Promise<ErrorAnalysis>;
    suggestFix(context: DebugContext): Promise<FixSuggestion>;
    explainStackTrace(trace: string): Promise<Explanation>;
    getBreakpointSuggestions(location: Location): Promise<Breakpoint[]>;
}
```

### 7.3 Event System

```typescript
// Event definitions for cross-service communication

interface AIEventMap {
    // Provider events
    'ai:provider:changed': { oldProvider: string; newProvider: string };
    'ai:provider:error': { provider: string; error: Error };
    'ai:provider:rate-limited': { provider: string; retryAfter: number };
    
    // Request/Response events
    'ai:request:started': { requestId: string; context: AIRequestContext };
    'ai:request:completed': { requestId: string; response: AIResponse };
    'ai:request:failed': { requestId: string; error: Error };
    'ai:request:cancelled': { requestId: string };
    
    // Context events
    'ai:context:changed': { change: ContextChange };
    'ai:context:updated': { context: CodeContext };
    
    // Completion events
    'ai:completion:requested': { position: Position };
    'ai:completion:provided': { items: CompletionItem[] };
    'ai:completion:accepted': { item: CompletionItem };
    'ai:completion:rejected': { item: CompletionItem };
    
    // Chat events
    'ai:chat:message:sent': { conversationId: string; message: IMessage };
    'ai:chat:message:received': { conversationId: string; message: IMessage };
    'ai:chat:conversation:created': { conversation: IConversation };
    
    // Index events
    'ai:index:started': { workspaceRoot: string };
    'ai:index:progress': { completed: number; total: number };
    'ai:index:completed': { indexedFiles: number };
    'ai:index:file:indexed': { filePath: string };
}
```

---

## 8. Data Layer & Storage

### 8.1 Storage Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      STORAGE LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              VS Code Storage API                          │   │
│  │    (Memento, SecretStorage, GlobalState)                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────┐      │
│  │                           │                           │      │
│  ▼                           ▼                           ▼      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │  Settings   │    │    Chat     │    │   Index     │          │
│  │   Store     │    │   Store     │    │   Store     │          │
│  │             │    │             │    │             │          │
│  │ • Provider  │    │ • Conversa- │    │ • Semantic  │          │
│  │   configs   │    │   tions     │    │   vectors   │          │
│  │ • API keys  │    │ • Messages  │    │ • Keywords  │          │
│  │ • User      │    │ • Mode      │    │ • File      │          │
│  │   prefs     │    │   history   │    │   metadata  │          │
│  │             │    │             │    │             │          │
│  │ Storage:    │    │ Storage:    │    │ Storage:    │          │
│  │ Secret/     │    │ SQLite/     │    │ SQLite/     │          │
│  │ GlobalState │    │ File        │    │ File        │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│         │                  │                  │                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   Cache     │    │  Analytics  │    │   Usage     │          │
│  │   Store     │    │   Store     │    │   Store     │          │
│  │             │    │             │    │             │          │
│  │ • AI        │    │ • Events    │    │ • Token     │          │
│  │   responses │    │ • Metrics   │    │   usage     │          │
│  │ • Complet-  │    │ • Opt-in    │    │ • Request   │          │
│  │   ions      │    │   data      │    │   counts    │          │
│  │ • Embeddings│    │             │    │             │          │
│  │             │    │ Storage:    │    │ Storage:    │          │
│  │ Storage:    │    │ File        │    │ File        │          │
│  │ Memory/     │    │ (anonymized)│    │ (local)     │          │
│  │ File        │    │             │    │             │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Data Models

```typescript
// Settings/Configuration
interface UserConfiguration {
    userId: string;
    preferredModel: string;
    preferredMode: AIMode;
    anonymousTelemetryOptIn: boolean;
    theme: 'light' | 'dark' | 'system';
    createdAt: Date;
    updatedAt: Date;
}

interface ProviderConfiguration {
    providerId: string;
    apiKey?: string; // Encrypted
    endpoint?: string;
    defaultModel: string;
    customModels: string[];
    rateLimits: {
        requestsPerMinute: number;
        tokensPerDay: number;
    };
    enabled: boolean;
}

// Conversation
interface Conversation {
    id: string;
    userId: string;
    mode: AIMode;
    title: string;
    messages: Message[];
    createdAt: Date;
    updatedAt: Date;
    metadata: {
        totalTokens: number;
        fileReferences: string[];
    };
}

interface Message {
    id: string;
    conversationId: string;
    role: 'system' | 'user' | 'assistant';
    content: string;
    contextSnapshot?: ContextSnapshot;
    timestamp: Date;
    tokensUsed?: number;
}

// Index
interface IndexedFile {
    fileId: string;
    filePath: string;
    language: string;
    lastModified: Date;
    lastIndexed: Date;
    contentHash: string;
    semanticChunks: SemanticChunk[];
    keywords: string[];
    symbols: SymbolInfo[];
}

interface SemanticChunk {
    chunkId: string;
    fileId: string;
    content: string;
    lineStart: number;
    lineEnd: number;
    embedding?: Float32Array;
    type: 'function' | 'class' | 'comment' | 'other';
}

// Cache
interface CacheEntry {
    key: string;
    data: any;
    createdAt: Date;
    expiresAt: Date;
    accessCount: number;
    lastAccessed: Date;
}

// Usage Analytics (opt-in)
interface UsageEvent {
    eventId: string;
    eventType: 'completion' | 'chat' | 'refactor' | 'search' | 'debug';
    timestamp: Date;
    payload: {
        provider: string;
        model: string;
        tokensUsed: number;
        latency: number;
        success: boolean;
    };
}
```

### 8.3 Storage Implementation

```typescript
// Storage service implementations

class SettingsStorage {
    constructor(
        @ISecretStorage private readonly secretStorage: ISecretStorage,
        @IStorageService private readonly storage: IStorageService
    ) {}
    
    async saveProviderConfig(config: ProviderConfiguration): Promise<void> {
        // Store API key securely
        if (config.apiKey) {
            await this.secretStorage.store(
                `ai.provider.${config.providerId}.apiKey`,
                config.apiKey
            );
        }
        
        // Store rest of config
        await this.storage.store(
            `ai.provider.${config.providerId}.config`,
            JSON.stringify({
                ...config,
                apiKey: undefined // Don't store API key here
            }),
            StorageScope.GLOBAL,
            StorageTarget.USER
        );
    }
    
    async getProviderConfig(providerId: string): Promise<ProviderConfiguration | undefined> {
        const configStr = await this.storage.get(
            `ai.provider.${providerId}.config`,
            StorageScope.GLOBAL
        );
        
        if (!configStr) return undefined;
        
        const config = JSON.parse(configStr);
        config.apiKey = await this.secretStorage.get(`ai.provider.${providerId}.apiKey`);
        
        return config;
    }
}

class ConversationStorage {
    private db: SQLiteDatabase;
    
    constructor(
        @IEnvironmentService private readonly envService: IEnvironmentService
    ) {
        this.db = new SQLiteDatabase(
            join(this.envService.userDataPath, 'conversations.db')
        );
    }
    
    async initialize(): Promise<void> {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                mode TEXT NOT NULL,
                title TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                metadata TEXT
            );
            
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                context_snapshot TEXT,
                timestamp INTEGER NOT NULL,
                tokens_used INTEGER,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_messages_conversation 
            ON messages(conversation_id);
        `);
    }
    
    async saveConversation(conv: Conversation): Promise<void> {
        await this.db.run(`
            INSERT OR REPLACE INTO conversations 
            (id, user_id, mode, title, created_at, updated_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [conv.id, conv.userId, conv.mode, conv.title, 
            conv.createdAt.getTime(), conv.updatedAt.getTime(),
            JSON.stringify(conv.metadata)]);
    }
    
    async getConversation(id: string): Promise<Conversation | undefined> {
        const row = await this.db.get(`
            SELECT * FROM conversations WHERE id = ?
        `, [id]);
        
        if (!row) return undefined;
        
        const messages = await this.db.all(`
            SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp
        `, [id]);
        
        return {
            id: row.id,
            userId: row.user_id,
            mode: row.mode,
            title: row.title,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            metadata: JSON.parse(row.metadata),
            messages: messages.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: new Date(m.timestamp),
                tokensUsed: m.tokens_used
            }))
        };
    }
}

class IndexStorage {
    constructor(
        @IFileService private readonly fileService: IFileService,
        @IEnvironmentService private readonly envService: IEnvironmentService
    ) {}
    
    async saveIndex(indexData: IndexedFile[]): Promise<void> {
        const indexPath = join(this.envService.userDataPath, 'ai-index.json');
        
        // Compress embeddings for storage
        const compressed = indexData.map(file => ({
            ...file,
            semanticChunks: file.semanticChunks.map(chunk => ({
                ...chunk,
                embedding: chunk.embedding ? this.compressEmbedding(chunk.embedding) : undefined
            }))
        }));
        
        await this.fileService.writeFile(
            URI.file(indexPath),
            VSBuffer.fromString(JSON.stringify(compressed))
        );
    }
    
    async loadIndex(): Promise<IndexedFile[]> {
        const indexPath = join(this.envService.userDataPath, 'ai-index.json');
        
        try {
            const content = await this.fileService.readFile(URI.file(indexPath));
            const data = JSON.parse(content.value.toString());
            
            return data.map((file: any) => ({
                ...file,
                semanticChunks: file.semanticChunks.map((chunk: any) => ({
                    ...chunk,
                    embedding: chunk.embedding ? this.decompressEmbedding(chunk.embedding) : undefined
                }))
            }));
        } catch {
            return [];
        }
    }
    
    private compressEmbedding(embedding: Float32Array): string {
        // Use quantization for compression
        return Buffer.from(embedding.buffer).toString('base64');
    }
    
    private decompressEmbedding(data: string): Float32Array {
        const buffer = Buffer.from(data, 'base64');
        return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
    }
}
```

---

## 9. Security & Privacy Implementation

### 9.1 Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: API Key Security                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • OS Keychain integration (macOS Keychain, Windows      │   │
│  │    Credential Manager, Linux libsecret)                  │   │
│  │  • Encrypted fallback storage (AES-256)                  │   │
│  │  • Memory-only option (keys never persisted)             │   │
│  │  • Key rotation warnings                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Layer 2: Data Transmission                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • TLS 1.3 for all external connections                  │   │
│  │  • Certificate pinning for known providers               │   │
│  │  • Request/response encryption at rest                   │   │
│  │  • Proxy support with authentication                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Layer 3: Privacy Controls                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • Local-only mode (no external AI calls)                │   │
│  │  • Selective code sharing (redaction options)            │   │
│  │  • PII detection and filtering                           │   │
│  │  • Audit logging (opt-in)                                │   │
│  │  • Data retention controls                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Layer 4: Extension Security                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • Sandboxed AI API access                               │   │
│  │  • Permission system for AI features                     │   │
│  │  • Rate limiting per extension                           │   │
│  │  • Activity monitoring                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Implementation Details

```typescript
// Security service implementations

class SecureKeyStorage {
    constructor(
        @ISecretStorage private readonly secretStorage: ISecretStorage,
        @ILogService private readonly logService: ILogService
    ) {}
    
    async storeKey(keyId: string, key: string): Promise<void> {
        // Validate key format
        if (!this.isValidApiKey(key)) {
            throw new Error('Invalid API key format');
        }
        
        // Store in OS keychain via VS Code's secret storage
        await this.secretStorage.store(`ai.key.${keyId}`, key);
        
        this.logService.info(`API key stored securely: ${keyId}`);
    }
    
    async retrieveKey(keyId: string): Promise<string | undefined> {
        return this.secretStorage.get(`ai.key.${keyId}`);
    }
    
    async deleteKey(keyId: string): Promise<void> {
        await this.secretStorage.delete(`ai.key.${keyId}`);
    }
    
    private isValidApiKey(key: string): boolean {
        // Basic validation - actual validation depends on provider
        return key.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(key);
    }
}

class PrivacyFilter {
    private piiPatterns = [
        { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: 'email' },
        { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, type: 'ssn' },
        { pattern: /\b(?:\d[ -]*?){13,16}\b/g, type: 'credit_card' },
        { pattern: /password\s*[:=]\s*["'][^"']+["']/gi, type: 'password' },
        { pattern: /api[_-]?key\s*[:=]\s*["'][^"']+["']/gi, type: 'api_key' },
        { pattern: /secret\s*[:=]\s*["'][^"']+["']/gi, type: 'secret' }
    ];
    
    filterSensitiveData(text: string): FilterResult {
        const detections: Detection[] = [];
        let filtered = text;
        
        for (const { pattern, type } of this.piiPatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                detections.push({
                    type,
                    position: match.index!,
                    length: match[0].length,
                    original: match[0]
                });
                
                // Replace with placeholder
                filtered = filtered.replace(match[0], `[${type.toUpperCase()}]`);
            }
        }
        
        return {
            filtered,
            detections,
            hasSensitiveData: detections.length > 0
        };
    }
    
    shouldSendToAI(context: CodeContext, settings: PrivacySettings): boolean {
        if (settings.localOnly) {
            return false;
        }
        
        if (settings.blockSensitiveFiles) {
            const sensitivePatterns = [/\.env/, /config\.json/, /secrets/];
            for (const file of context.openFiles || []) {
                if (sensitivePatterns.some(p => p.test(file.path))) {
                    return false;
                }
            }
        }
        
        return true;
    }
}

class AuditLogger {
    constructor(
        @IFileService private readonly fileService: IFileService,
        @IEnvironmentService private readonly envService: IEnvironmentService
    ) {}
    
    async log(event: AuditEvent): Promise<void> {
        const logEntry = {
            timestamp: new Date().toISOString(),
            eventType: event.type,
            provider: event.provider,
            model: event.model,
            tokensUsed: event.tokensUsed,
            success: event.success,
            duration: event.duration,
            // Never log actual code content or API keys
            fileCount: event.fileCount,
            operation: event.operation
        };
        
        const logPath = join(this.envService.userDataPath, 'ai-audit.log');
        const logLine = JSON.stringify(logEntry) + '\n';
        
        await this.fileService.writeFile(
            URI.file(logPath),
            VSBuffer.fromString(logLine),
            { append: true }
        );
    }
}
```

---

## 10. Testing Strategy

### 10.1 Testing Pyramid

```
                    ┌─────────┐
                    │   E2E   │  10% - Full user workflows
                    │  Tests  │      Playwright
                    ├─────────┤
                    │Integration│ 20% - Service integration
                    │  Tests  │      Jest/Mocha
                    ├─────────┤
                    │  Unit   │  70% - Individual functions
                    │  Tests  │      Jest with mocking
                    └─────────┘
```

### 10.2 Test Implementation

```typescript
// Unit test examples

// Provider test
describe('OpenAIProvider', () => {
    let provider: OpenAIProvider;
    let mockClient: jest.Mocked<OpenAI>;
    
    beforeEach(() => {
        mockClient = {
            chat: {
                completions: {
                    create: jest.fn()
                }
            }
        } as any;
        
        provider = new OpenAIProvider();
        (provider as any).client = mockClient;
    });
    
    it('should send request successfully', async () => {
        const mockResponse = {
            choices: [{ message: { content: 'test response' } }],
            usage: { total_tokens: 100 },
            model: 'gpt-4o'
        };
        
        mockClient.chat.completions.create.mockResolvedValue(mockResponse as any);
        
        const result = await provider.sendRequest({
            query: 'test',
            mode: 'coding'
        });
        
        expect(result.content).toBe('test response');
        expect(result.tokensUsed).toBe(100);
        expect(result.provider).toBe('openai');
    });
    
    it('should handle rate limit errors', async () => {
        const error = new Error('Rate limit exceeded');
        (error as any).status = 429;
        
        mockClient.chat.completions.create.mockRejectedValue(error);
        
        await expect(provider.sendRequest({
            query: 'test',
            mode: 'coding'
        })).rejects.toThrow(AIRateLimitError);
    });
});

// Context manager test
describe('ContextManager', () => {
    let contextManager: ContextManager;
    let mockEditorService: jest.Mocked<IEditorService>;
    
    beforeEach(() => {
        mockEditorService = {
            onDidActiveEditorChange: jest.fn(),
            activeEditor: {
                getModel: () => ({
                    getValue: () => 'const x = 1;',
                    uri: { fsPath: '/test/file.ts' }
                })
            }
        } as any;
        
        contextManager = new ContextManager(
            mockEditorService,
            {} as any,
            {} as any
        );
    });
    
    it('should gather current file context', async () => {
        const context = await contextManager.getCurrentFileContext();
        
        expect(context).toEqual({
            path: '/test/file.ts',
            content: 'const x = 1;',
            language: 'typescript'
        });
    });
});

// Integration test example
describe('AI Completion Integration', () => {
    let completionProvider: AICompletionProvider;
    let aiService: IAIService;
    let contextManager: IContextManager;
    
    beforeEach(async () => {
        // Setup test environment
        const app = await createTestApp();
        
        aiService = app.get(IAIService);
        contextManager = app.get(IContextManager);
        completionProvider = app.get(AICompletionProvider);
        
        // Mock AI provider
        jest.spyOn(aiService, 'sendRequest').mockImplementation(async () => ({
            content: 'completed code',
            tokensUsed: 50,
            provider: 'test',
            model: 'test-model',
            latency: 100,
            finishReason: 'stop'
        }));
    });
    
    it('should provide inline completion', async () => {
        const model = createTextModel('function greet() {\n  ');
        const position = { lineNumber: 2, column: 3 };
        
        const result = await completionProvider.provideInlineCompletions(
            model,
            position,
            { triggerKind: InlineCompletionTriggerKind.Automatic },
            CancellationToken.None
        );
        
        expect(result.items).toHaveLength(1);
        expect(result.items[0].insertText).toBe('completed code');
    });
});

// E2E test example
describe('AI Chat E2E', () => {
    let app: Application;
    
    beforeAll(async () => {
        app = await startApp({
            aiProvider: 'mock',
            mockResponses: {
                'hello': 'Hello! How can I help?'
            }
        });
    });
    
    afterAll(async () => {
        await app.stop();
    });
    
    it('should complete chat workflow', async () => {
        // Open chat panel
        await app.workbench.quickaccess.runCommand('AI: Open Chat');
        
        // Type message
        await app.workbench.aiChat.typeMessage('hello');
        await app.workbench.aiChat.sendMessage();
        
        // Wait for response
        const response = await app.workbench.aiChat.waitForResponse();
        
        expect(response).toContain('Hello! How can I help?');
    });
});
```

### 10.3 Test Coverage Requirements

| Component | Coverage Target |
|-----------|----------------|
| Provider Layer | 90% |
| Context Manager | 85% |
| Completion Engine | 85% |
| Chat Service | 80% |
| Refactoring Engine | 80% |
| Indexing | 75% |
| Debug Assistant | 75% |
| UI Components | 70% |

---

## 11. Deployment & DevOps

### 11.1 CI/CD Pipeline

```yaml
# .github/workflows/build.yml
name: Build and Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run linting
        run: npm run eslint
        
      - name: Run unit tests
        run: npm run test-node
        
      - name: Run AI module tests
        run: npm run test-ai
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  build:
    needs: test
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run compile
        
      - name: Package
        run: npm run gulp vscode-${{ matrix.os }}
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: fewstepaway-${{ matrix.os }}
          path: .build/fewstepaway-*
```

### 11.2 Release Process

```bash
#!/bin/bash
# scripts/release.sh

set -e

VERSION=$1

# Validate version
if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Invalid version format. Use x.y.z"
    exit 1
fi

# Run tests
echo "Running tests..."
npm test

# Update version
echo "Updating version to $VERSION..."
npm version $VERSION --no-git-tag-version

# Generate changelog
echo "Generating changelog..."
npx conventional-changelog -p angular -i CHANGELOG.md -s

# Build for all platforms
echo "Building..."
npm run compile

# Package
echo "Packaging..."
npm run gulp vscode-linux
npm run gulp vscode-win32
npm run gulp vscode-darwin

# Create release
echo "Creating GitHub release..."
gh release create v$VERSION \
    --title "FewStepAway v$VERSION" \
    --notes-file CHANGELOG.md \
    .build/fewstepaway-*

echo "Release v$VERSION complete!"
```

### 11.3 Distribution Channels

| Channel | Target | Frequency |
|---------|--------|-----------|
| GitHub Releases | All users | Each release |
| Homebrew (macOS) | macOS users | Automated |
| Snap Store (Linux) | Linux users | Automated |
| WinGet (Windows) | Windows users | Automated |
| Website Download | New users | Each release |

---

## 12. Risk Mitigation

### 12.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| VS Code upstream merge conflicts | High | High | Automated merge, minimal core changes |
| AI provider API changes | Medium | Medium | Abstraction layer, multi-provider |
| Performance degradation | Medium | High | Profiling, lazy loading, caching |
| Extension compatibility issues | Low | High | Extension host isolation, testing |
| Local model resource limits | Low | Medium | Hardware detection, fallback to cloud |
| Security vulnerability | Low | Critical | Security audits, encryption, least privilege |
| Community adoption slow | Medium | High | Marketing, documentation, community building |

### 12.2 Contingency Plans

1. **VS Code Merge Issues**
   - Maintain minimal changes to core
   - Use extension points where possible
   - Automated merge testing
   - Fallback: Thin integration layer approach

2. **Provider API Changes**
   - Versioned provider adapters
   - Graceful degradation
   - Community-driven provider updates

3. **Performance Issues**
   - Feature toggles for heavy features
   - Profiling and optimization sprints
   - Resource usage monitoring

---

## 13. Appendices

### 13.1 Glossary

| Term | Definition |
|------|------------|
| AI Mode | Context-specific AI behavior (coding, architect, debug, learning) |
| Ghost Text | Inline AI suggestions shown as faint text |
| Context Window | Amount of code/text sent to AI provider |
| Embedding | Vector representation of text for semantic search |
| Token | Unit of text for AI processing (roughly 4 characters) |
| Provider | AI service (OpenAI, Anthropic, etc.) |
| MCP | Model Context Protocol for tool interfaces |

### 13.2 References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Anthropic API Documentation](https://docs.anthropic.com)
- [MCP Specification](https://modelcontextprotocol.io)

---

*Document Version: 1.0*
*Last Updated: 2026-02-14*
*Status: Draft - Pending Review*
