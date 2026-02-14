# FewStepAway - Development Setup

## Prerequisites

- Node.js 20.x (see `.nvmrc`)
- npm 10.x
- Python 3.x (for some dependencies)
- Git

## Quick Setup

### 1. Clone and Install

```bash
git clone https://github.com/rejisterjack/fewstepaway.git
cd fewstepaway
npm install
```

### 2. Build

```bash
# Full build
npm run compile

# Watch mode (for development)
npm run watch
```

### 3. Run Development Version

```bash
# macOS/Linux
./scripts/code.sh

# Windows
./scripts/code.bat
```

## AI Development Setup

### 1. Configure AI Provider

Create `.env` file or configure via UI:

```bash
# OpenAI
export OPENAI_API_KEY="your-key"

# Anthropic
export ANTHROPIC_API_KEY="your-key"
```

### 2. Test AI Features

```bash
# Run AI-specific tests
npm run test-ai

# Run all tests
npm run test-node
```

## Development Workflow

### Branch Naming

- `feature/ai-[feature-name]` - New AI features
- `fix/ai-[bug-description]` - Bug fixes
- `docs/[description]` - Documentation

### Commit Messages

Follow conventional commits:

```
feat(ai): add Anthropic provider support
fix(completion): resolve ghost text flickering
docs: update API documentation
```

### Testing

```bash
# Unit tests
npm run test-node

# AI module tests
npm run test-ai

# Linting
npm run eslint

# Type checking
npm run compile-check-ts-native
```

## Project Structure

```
fewstepaway/
├── src/vs/               # VS Code core
│   ├── ai/              # 🎯 AI MODULE (our code)
│   ├── base/            # Base utilities
│   ├── editor/          # Editor components
│   ├── workbench/       # Workbench UI
│   └── platform/        # Platform abstractions
├── docs/                # Documentation
├── build/               # Build scripts
└── scripts/             # Development scripts
```

## Common Issues

### Build Errors

```bash
# Clean build
rm -rf out/
npm run compile

# Reset node_modules
rm -rf node_modules
npm install
```

### Test Failures

```bash
# Update test snapshots
npm run test-node -- --updateSnapshot

# Run specific test
npm run test-node -- --grep "test-name"
```

## Resources

- [Master Plan](./MASTER-PLAN.md) - Complete development roadmap
- [Architecture Docs](./docs/architecture/)
- [API Specs](./docs/api/)

## Support

- GitHub Issues: https://github.com/rejisterjack/fewstepaway/issues
- Discussions: https://github.com/rejisterjack/fewstepaway/discussions
