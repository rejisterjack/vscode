# FewStepsAway AI Module

This directory contains the AI integration layer for FewStepsAway - an AI-native code editor.

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
├── common/              # Types, configuration, rate limiting
├── provider/            # Multi-provider implementations + protocols
├── context/             # Context manager
├── suggestion/          # Inline completion + next-edit
├── chat/                # Chat UI services + streaming
├── agent/               # Agent loop, permissions, background agent
├── mode/                # Ask/plan/debug mode prompts
├── tool/                # Agent tools (read, write, grep, bash, …)
├── mcp/                 # MCP tool bridge
├── composer/            # Multi-file composer + multi-hunk edits
├── indexing/            # Embeddings + semantic/hybrid search
├── auth/                # FewStepsAway platform PKCE auth
├── backend/             # Platform API client + SSE
├── review/              # AI review findings
├── scm/                 # Commit message generation
├── integrity/           # Edit integrity + workspace tasks
├── debt/                # Technical debt signals (types)
├── enhance/             # Prompt enhancement
├── rules/               # Project rules loader
├── onboarding/          # Onboarding types
├── extension-api/       # Third-party AI extension API
├── electron-main/       # Main-process AI server channel
└── ai.contribution.ts   # Module entry contribution
```

Legacy README sections (refactoring/, debug/, search/ as top-level) may be folded into agent/tool modules — trust the tree above over older diagrams.

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
