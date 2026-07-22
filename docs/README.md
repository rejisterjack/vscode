---
title: "FewStepsAway IDE Docs Index"
description: "Canonical index for FewStepsAway (VS Code fork) product documentation, with a start-here reading order for agents."
last_updated: "2026-07-22"
---

# FewStepsAway IDE Docs Index

Open-source AI-native code editor (VS Code fork). Day-to-day agent conventions: [AGENTS.md](../AGENTS.md).

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
| [specifications/features/](./specifications/features/) | Shipped feature specs |
| [specifications/technical-specifications.md](./specifications/technical-specifications.md) | High-level technical spec |
| [api/](./api/) | API documentation |
| [database/](./database/) | Data schemas |
| [infrastructure/](./infrastructure/) | Infra requirements |
| [roadmap/implementation-roadmap.md](./roadmap/implementation-roadmap.md) | Phased roadmap (detail) |
| [ecosystem/ECOSYSTEM.md](./ecosystem/ECOSYSTEM.md) | Multi-client ecosystem |

## Production launch status (Jul 2026)

| Layer | Status |
|-------|--------|
| `src/vs/ai/` P0 features | Engineering shipped — see feature specs |
| Product / pilot gate | **Not complete** — requires platform + enterprise pilots |
| Desktop release channel | Confirm with maintainers — no EAS config in repo |
