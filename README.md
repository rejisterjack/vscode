# FewStepsAway - AI Native Code Editor

[![Vision](vision.md)](vision.md)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE.txt)

## 🚀 The Vision

**FewStepsAway** is an open-source, AI-native code editor that feels like the future of development—where AI is woven into every interaction, not bolted on as an afterthought.

Built by forking VS Code and embedding AI capabilities natively, creating an editor that is:

- **Fast** — No extension overhead, instant startup, responsive AI interactions
- **Open** — Apache 2.0 license, community-driven, fully transparent
- **Flexible** — Bring your own AI provider, use any model you prefer
- **Familiar** — Full VS Code compatibility, existing extensions work seamlessly

## 🎯 Key Differentiators

| Dimension | FewStepsAway | Market Standard |
|-----------|--------------|-----------------|
| **Integration Depth** | Native—AI is core to the editor | Extension—AI runs as add-on |
| **Provider Freedom** | 500+ models, any provider | Locked to vendor's choice |
| **Openness** | Fully open-source, Apache 2.0 | Closed-source or limited |
| **Performance** | Optimized, stripped-down core | Bloated with legacy features |
| **Community** | Community-driven development | Corporate-controlled roadmap |

## 🛠️ Development Setup

### Prerequisites

- **Node.js** (see `.nvmrc` for version)
- **npm** or **yarn**
- **Git**

### Quick Start

```bash
# Clone the repository
git clone https://github.com/rejisterjack/fewstepsaway.git
cd fewstepsaway

# Install dependencies
npm install

# Build the project
npm run compile

# Run the editor
./scripts/fewstepsaway.sh
```

### Reference Repositories

The `references/` folder contains valuable reference implementations:

- **cline** - Popular VS Code extension for AI coding
- **Roo-Code** - Advanced AI coding assistant (formerly Roo Cline)
- **anthropic-cookbook** - Patterns for building with Claude
- **python-sdk** - Model Context Protocol (MCP) SDK

See [references/README.md](references/README.md) for details.

## 🏗️ Project Structure

```
fewstepsaway/
├── src/                    # Main source code
├── extensions/             # Built-in extensions
├── build/                  # Build scripts and configuration
├── scripts/                # Development and utility scripts
├── references/             # Reference implementations
├── test/                   # Test suites
└── cli/                    # CLI tools (Rust)
```

## 🎯 Core Features (Planned)

- **AI Chat Interface** - Native chat with context-aware AI assistance
- **Ghost Text** - Inline AI suggestions as you type
- **Intelligent Refactoring** - Natural language code transformations
- **Multi-Provider Support** - OpenAI, Anthropic, Google, AWS, OpenRouter, local models
- **MCP Integration** - Standardized tool interfaces for AI agents
- **Codebase Indexing** - Semantic search across your entire project

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test`
5. Submit a pull request

## 📚 Documentation

- [Product Vision](vision.md) - Full vision and roadmap
- [Contributing Guide](CONTRIBUTING.md) - How to contribute
- [References](references/README.md) - Reference implementations

## 📄 License

Licensed under the [Apache License 2.0](LICENSE.txt).

Copyright (c) FewStepsAway Team and contributors.

## 🙏 Acknowledgments

This project is a fork of [Visual Studio Code](https://github.com/microsoft/vscode) by Microsoft. We are grateful for their excellent work on the foundation of this editor.

---

**FewStepsAway** - *The editor AI-native development deserves.*
