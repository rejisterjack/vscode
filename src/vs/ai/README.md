# FewStepAway AI Module

This directory contains the AI integration layer for FewStepAway - an AI-native code editor.

## Overview

The AI module provides native AI capabilities deeply integrated into the editor:

- **Multi-Provider Support**: OpenAI, Anthropic, Google, AWS, OpenRouter, Local Models
- **Context Management**: Intelligent code context gathering and token budgeting
- **Inline Completions**: Ghost text suggestions with caching and debouncing
- **Chat Interface**: Multi-mode AI conversations with streaming
- **Refactoring**: Natural language code refactoring with preview
- **Semantic Search**: Vector-based code search
- **Debug Assistant**: AI-powered debugging insights

## Directory Structure

```
src/vs/ai/
├── common/              # Shared types and utilities
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Helper utilities
├── provider/           # AI provider implementations
│   ├── common/         # Base provider interfaces
│   ├── openai/         # OpenAI integration
│   ├── anthropic/      # Anthropic integration
│   ├── google/         # Google Gemini integration
│   ├── aws/            # AWS Bedrock integration
│   ├── openrouter/     # OpenRouter integration
│   └── local/          # Local model support (Ollama, LM Studio)
├── context/            # Context management
├── completion/         # Inline completion (ghost text)
├── chat/               # Chat interface
├── refactoring/        # Code refactoring
├── indexing/           # Codebase indexing
├── debug/              # AI debugging assistant
├── search/             # Semantic search
└── extension-api/      # Extension API
```

## Quick Start

### 1. Configuration

Configure your AI provider in settings:

```json
{
  "ai.provider.default": "openai",
  "ai.provider.openai.apiKey": "your-api-key",
  "ai.provider.openai.model": "gpt-4o"
}
```

### 2. Usage

- **Inline Completion**: Start typing to see AI suggestions
- **Chat**: Press `Ctrl+Shift+A` to open AI chat
- **Refactor**: Select code and press `Ctrl+Shift+R` to refactor

## Development

### Building

```bash
npm run compile-ai
```

### Testing

```bash
npm run test-ai
```

### Adding a New Provider

1. Create a new directory in `provider/`
2. Implement the `IAIProvider` interface
3. Register in `ProviderRegistry`
4. Add configuration schema

See `provider/openai/` for an example implementation.

## Architecture

### High-Level Flow

```
User Input → Context Manager → AI Service → Provider → AI Response
                  ↓
            Token Budget
            Management
```

### Key Components

- **AI Service**: Main entry point for AI operations
- **Context Manager**: Gathers and manages code context
- **Provider Registry**: Manages multiple AI providers
- **Completion Provider**: Ghost text integration
- **Chat Service**: Conversation management

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

Apache 2.0 - See [LICENSE.txt](../../LICENSE.txt)
