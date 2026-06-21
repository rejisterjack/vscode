# FewStepsAway - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Prerequisites
```bash
# Check Node.js version (should be 20.x)
node --version

# Check npm version
npm --version
```

### 2. Install Dependencies
```bash
cd fewstepsaway
npm install
```

### 3. Build the Project
```bash
# First build (takes ~5-10 minutes)
npm run compile

# Subsequent builds are faster
npm run watch
```

### 4. Run FewStepsAway
```bash
# macOS/Linux
./scripts/code.sh

# Windows
./scripts/code.bat
```

### 5. Configure AI Provider
1. Open FewStepsAway
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type "AI: Open Settings"
4. Enter your API key

## 🎯 Development Priorities

### Current Focus (Phase 1)
1. **Provider Abstraction** - OpenAI integration
2. **Context Manager** - Code context gathering
3. **Inline Completion** - Ghost text suggestions
4. **Configuration** - Settings and secure storage

### Next Up (Phase 2)
1. Multi-provider support (Anthropic, Google, etc.)
2. Chat interface
3. Natural language refactoring
4. Local model support (Ollama)

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/vs/ai/common/types/ai.types.ts` | Core AI type definitions |
| `src/vs/ai/provider/common/aiProvider.ts` | Base provider interface |
| `src/vs/ai/context/contextManager.ts` | Context management |
| `MASTER-PLAN.md` | Complete development roadmap |
| `SETUP.md` | Detailed setup instructions |

## 🛠️ Common Commands

```bash
# Build
npm run compile

# Watch mode (auto-rebuild on changes)
npm run watch

# Run tests
npm run test-node

# Lint
npm run eslint

# Type check
npm run compile-check-ts-native

# Clean build
rm -rf out/ && npm run compile
```

## 🧪 Testing Your Changes

```bash
# Run specific test
npm run test-node -- --grep "ContextManager"

# Run with coverage
npm run test-node -- --coverage

# Debug tests
npm run test-node -- --inspect-brk
```

## 🔧 Troubleshooting

### Build Fails
```bash
# Clean everything
rm -rf out/ node_modules/
npm install
npm run compile
```

### TypeScript Errors
```bash
# Check types
npm run compile-check-ts-native
```

### Extension Not Loading
```bash
# Check for syntax errors
npm run eslint

# Rebuild
npm run compile
```

## 📚 Documentation

- [Master Plan](./MASTER-PLAN.md) - Complete roadmap
- [Architecture](./docs/architecture/system-architecture.md) - System design
- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md) - Detailed specs
- [SETUP.md](./SETUP.md) - Full setup guide

## 🤝 Contributing

1. Create a branch: `git checkout -b feature/ai-[name]`
2. Make changes
3. Run tests: `npm run test-node`
4. Commit: `git commit -m "feat(ai): description"`
5. Push: `git push origin feature/ai-[name]`

## 💡 Tips

- Use `npm run watch` during development for auto-rebuild
- Check `MASTER-PLAN.md` for task priorities
- Follow existing code style (see `AGENTS.md`)
- Write tests for new features
- Update documentation with changes

## 🐛 Reporting Issues

1. Check existing issues first
2. Include reproduction steps
3. Provide system info (OS, Node version)
4. Include error logs

## 📞 Support

- **Issues**: https://github.com/rejisterjack/fewstepsaway/issues
- **Discussions**: https://github.com/rejisterjack/fewstepsaway/discussions

---

**Ready to code?** Start with `npm run compile` and then `./scripts/code.sh` 🚀
