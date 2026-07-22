---
title: "FewStepsAway IDE Docs Index"
description: "Canonical index for FewStepsAway (VS Code fork) product documentation, with a start-here reading order for agents."
last_updated: "2026-07-22"
---

# FewStepsAway IDE Docs Index

Open-source AI-native code editor (VS Code fork). Day-to-day agent conventions: [AGENTS.md](../AGENTS.md).

## Start here

1. **[VISION.md](./VISION.md)** — product narrative and Phase 1 scope.
2. **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** — detailed phased plan (historical + future).
3. **[../AGENTS.md](../AGENTS.md)** — build/run conventions and AI isolation boundary (`src/vs/ai/`).
4. **[specifications/features/](./specifications/features/)** — P0 feature specs with acceptance criteria.
5. **[status/feature-status.md](./status/feature-status.md)** — honest completion ledger.

**Platform** (auth, billing, audit): sibling repo [fewstepsapp](../fewstepsapp/docs/README.md).

**Agents:** keep these docs truthful — `.cursor/rules/03-product-docs-maintenance.mdc`. Update specs when behavior changes; append `feature-status.md` on complete.

## Categories

| Path | Description |
|------|-------------|
| [VISION.md](./VISION.md) | North-star vision |
| [business/prd.md](./business/prd.md) | IDE Phase 1 PRD |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Full implementation plan |
| [architecture/](./architecture/) | System architecture |
| [specifications/features/](./specifications/features/) | Shipped feature specs |
| [specifications/technical-specifications.md](./specifications/technical-specifications.md) | High-level technical spec |
| [api/](./api/) | API documentation |
| [database/](./database/) | Data schemas |
| [infrastructure/](./infrastructure/) | Infra requirements |
| [roadmap/](./roadmap/) | Roadmap artifacts |
| [ecosystem/](./ecosystem/) | Multi-client ecosystem |
| [operations/build-and-release.md](./operations/build-and-release.md) | Build, test, release |
| [status/](./status/) | Feature status ledger |

## Production launch status (Jul 2026)

| Layer | Status |
|-------|--------|
| `src/vs/ai/` P0 features | Engineering shipped — see feature specs |
| Product / pilot gate | **Not complete** — requires platform + enterprise pilots |
| Desktop release channel | Confirm with maintainers — no EAS config in repo |
