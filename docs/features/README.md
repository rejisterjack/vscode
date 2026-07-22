---
title: "Feature Specifications (index)"
description: "Canonical feature specs for FewStepsAway IDE live under docs/specifications/features/ — this directory is the index hub."
last_updated: "2026-07-22"
---

# Feature Specifications

**Canonical specs:** [../specifications/features/](../specifications/features/)

Implementation for these specs lives under **`src/vs/ai/`** unless an ADR documents a required core VS Code integration point. See [decisions/0001-ai-layer-isolation-and-multi-provider.md](../decisions/0001-ai-layer-isolation-and-multi-provider.md).

| Spec | Summary |
|------|---------|
| [ai-providers.md](../specifications/features/ai-providers.md) | Multi-provider `IAIProvider` registry and configuration |
| [inline-completion.md](../specifications/features/inline-completion.md) | Inline suggestions and acceptance flow |
| [chat-agent-modes.md](../specifications/features/chat-agent-modes.md) | Chat UI, agent modes, tools, MCP |
| [codebase-indexing.md](../specifications/features/codebase-indexing.md) | Semantic / hybrid codebase indexing |
| [platform-auth.md](../specifications/features/platform-auth.md) | PKCE auth against FewStepsAway platform |

Completion ledger: [../status/feature-status.md](../status/feature-status.md).

**Why specs are not duplicated here:** Historical links and cross-references point at `docs/specifications/features/`. This `features/` directory exists to match the shared monorepo docs layout without a mass file move.
