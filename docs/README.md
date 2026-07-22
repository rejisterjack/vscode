---
title: "FewStepsAway IDE Docs Index"
description: "Canonical index for FewStepsAway (VS Code fork) product documentation, with a start-here reading order for agents."
last_updated: "2026-07-22"
---

# FewStepsAway IDE Docs Index

Open-source AI-native code editor (VS Code fork). Day-to-day agent conventions: [AGENTS.md](../AGENTS.md).


## Authority chain (one source of truth per layer)

| Layer | Document | Use when |
|-------|----------|----------|
| Narrative | [VISION.md](./VISION.md) | IDE product thesis |
| Implementation companion | [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Phased plan vs shipped `src/vs/ai/` |
| Requirements | [business/prd.md](./business/prd.md) | IDE Phase 1 PRD |
| Feature specs | [specifications/features/*.md](./specifications/features/) | Shipped AI features |
| Sequencing | [ROADMAP.md](./ROADMAP.md) · [roadmap/implementation-roadmap.md](./roadmap/implementation-roadmap.md) | Phase gates |
| Ship status | [status/feature-status.md](./status/feature-status.md) | Completion ledger |
| AI isolation ADR | [decisions/0001-ai-layer-isolation-and-multi-provider.md](./decisions/0001-ai-layer-isolation-and-multi-provider.md) | `src/vs/ai/` boundary |
| Platform sibling | [fewstepsapp docs](../fewstepsapp/docs/README.md) | Auth, billing, API |

---
## Start here

Shared monorepo docs layout, with IDE-specific north-star companion:

1. **[VISION.md](./VISION.md)** — product narrative and organisation-first thesis.
2. **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** — **IDE north-star companion** (detailed phased plan; keep in sync with shipped `src/vs/ai/` behavior).
3. **[business/prd.md](./business/prd.md)** — IDE Phase 1 PRD (platform PRD: [fewstepsapp](../fewstepsapp/docs/business/prd.md)).
4. **[features/](./features/)** — index hub; canonical specs in [specifications/features/](./specifications/features/).
5. **[../AGENTS.md](../AGENTS.md)** — build/run conventions and AI isolation boundary (`src/vs/ai/`).
6. **[ROADMAP.md](./ROADMAP.md)** — summary hub; detail in [roadmap/implementation-roadmap.md](./roadmap/implementation-roadmap.md).
7. **[operations/build-and-release.md](./operations/build-and-release.md)** — primary build, test, and release ops.

**Phase-scope ADR:** [decisions/0001-ai-layer-isolation-and-multi-provider.md](./decisions/0001-ai-layer-isolation-and-multi-provider.md). **Architecture hub:** [ARCHITECTURE.md](./ARCHITECTURE.md). **Ledger:** [status/feature-status.md](./status/feature-status.md).

**Platform** (auth, billing, audit): sibling repo [fewstepsapp](../fewstepsapp/docs/README.md).

**Agents:** keep these docs truthful — `.cursor/rules/03-product-docs-maintenance.mdc`. Update specs when behavior changes; append `feature-status.md` on complete.

## Canonical layout

| Path | Role |
|------|------|
| [README.md](./README.md) | This index |
| [VISION.md](./VISION.md) | North-star vision |
| [ROADMAP.md](./ROADMAP.md) | Root roadmap hub → [roadmap/](./roadmap/) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Root architecture hub → [architecture/](./architecture/) |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Detailed implementation plan (IDE companion) |
| [business/prd.md](./business/prd.md) | Phase 1 PRD |
| [features/](./features/) | Index → [specifications/features/](./specifications/features/) |
| [decisions/](./decisions/) | ADRs ([README](./decisions/README.md)) |
| [status/feature-status.md](./status/feature-status.md) | Completion ledger |
| [engineering/](./engineering/) | _(not used — IDE uses architecture/, api/, specifications/)_ |
| [operations/](./operations/) | Build, release, ops |
| [runbooks/](./runbooks/) | Runbook index ([README](./runbooks/README.md); add ops runbooks as needed) |

## Categories

| Path | Description |
|------|-------------|
| [architecture/system-architecture.md](./architecture/system-architecture.md) | System architecture (detail) |
| [specifications/features/](./specifications/features/) | Shipped feature specs ([index](./specifications/features/README.md)) |
| [AI providers](specifications/features/ai-providers.md) | Multi-provider layer |
| [Chat & agent modes](specifications/features/chat-agent-modes.md) | Chat UI and modes |
| [Codebase indexing](specifications/features/codebase-indexing.md) | Semantic index |
| [Inline completion](specifications/features/inline-completion.md) | Inline suggestions |
| [Platform auth](specifications/features/platform-auth.md) | Platform session handoff |
| [specifications/technical-specifications.md](./specifications/technical-specifications.md) | High-level technical spec |
| [api/api-specifications.md](./api/api-specifications.md) | API specifications |
| [database/schemas.md](./database/schemas.md) | Data schemas |
| [infrastructure/infrastructure-requirements.md](./infrastructure/infrastructure-requirements.md) | Infra requirements |
| [risk/risk-assessment.md](./risk/risk-assessment.md) | Risk assessment |
| [superpowers/specs/2026-06-21-app-icon-design.md](./superpowers/specs/2026-06-21-app-icon-design.md) | App icon design spec |
| [roadmap/implementation-roadmap.md](./roadmap/implementation-roadmap.md) | Phased roadmap (detail) |
| [ecosystem/ECOSYSTEM.md](./ecosystem/ECOSYSTEM.md) | Multi-client ecosystem |

## Production launch status (Jul 2026)

| Layer | Status |
|-------|--------|
| `src/vs/ai/` P0 features | Engineering shipped — see feature specs |
| Product / pilot gate | **Not complete** — requires platform + enterprise pilots |
| Desktop release channel | Confirm with maintainers — no EAS config in repo |
