---
title: "FewStepsAway IDE Architecture"
description: "Root architecture hub — system design for the VS Code fork and AI integration layer."
last_updated: "2026-07-22"
---

# FewStepsAway IDE Architecture

**Detailed architecture:** [architecture/system-architecture.md](./architecture/system-architecture.md)

## At a glance

- **Editor core** — upstream VS Code fork; extensions and workbench behavior preserved where possible.
- **AI integration layer** — native product code under `src/vs/ai/` (providers, context, indexing, completion, chat, agent, tools). See [decisions/0001-ai-layer-isolation-and-multi-provider.md](./decisions/0001-ai-layer-isolation-and-multi-provider.md).
- **Platform** — identity, billing, audit, and org policy in sibling repo [fewstepsapp](../fewstepsapp); IDE integrates via documented APIs and [specifications/features/platform-auth.md](./specifications/features/platform-auth.md).

Supporting references: [specifications/technical-specifications.md](./specifications/technical-specifications.md), [api/api-specifications.md](./api/api-specifications.md), [database/schemas.md](./database/schemas.md), [infrastructure/infrastructure-requirements.md](./infrastructure/infrastructure-requirements.md).
