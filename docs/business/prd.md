---
title: "Product Requirements Document (IDE)"
description: "PRD for FewStepsAway IDE — Phase 1 Core Intelligence scope aligned with platform PRD."
last_updated: "2026-07-22"
---

# FewStepsAway IDE — Product Requirements (Phase 1)

This PRD covers the **VS Code fork** (`fewstepside`). Platform identity, billing, and org admin requirements live in `../fewstepsapp/docs/business/prd.md`.

## Executive summary

Deliver a VS Code–compatible editor where AI is embedded in completion, chat, and agent workflows, with multi-provider support and codebase-aware context. Phase 1 targets pilot teams connected to the FewStepsAway platform for auth and audit.

## Personas

Same as platform PRD — Ananya (platform eng lead), Rohan (GCC EM), Priya (staff engineer). See [fewstepsapp PRD](../fewstepsapp/docs/business/prd.md) §4.

## Phase 1 scope (P0)

| Capability | Spec | Engineering status |
|------------|------|-------------------|
| Multi-provider AI | [ai-providers.md](../specifications/features/ai-providers.md) | Shipped in `src/vs/ai/provider/` |
| Inline completion | [inline-completion.md](../specifications/features/inline-completion.md) | Shipped |
| Chat + agent modes | [chat-agent-modes.md](../specifications/features/chat-agent-modes.md) | Shipped |
| Codebase indexing | [codebase-indexing.md](../specifications/features/codebase-indexing.md) | Shipped (hybrid/semantic) |
| Platform auth (PKCE) | [platform-auth.md](../specifications/features/platform-auth.md) | Shipped |

## Out of scope (Phase 1)

- JetBrains / Neovim clients ([ECOSYSTEM.md](../ecosystem/ECOSYSTEM.md))
- Full Org-Brain wiki/Confluence ingestion (platform Phase 2)
- On-device model training
- Modifications to upstream VS Code outside `src/vs/ai/` except documented integration points

## Success metrics (align with platform OKRs)

- ≥60% suggestion acceptance in pilot orgs (measure via IDE telemetry + platform audit when connected)
- Time-to-first-commit ≤5 days for new hires (joint IDE + platform metric)

## Open product decisions

1. Default provider for disconnected/offline mode
2. Which agent tools are enabled by default in enterprise policy
3. Release channel cadence vs upstream VS Code merge
