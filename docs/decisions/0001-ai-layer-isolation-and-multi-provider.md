---
title: "ADR 0001 — AI Layer Isolation and Multi-Provider Architecture"
description: "Keep AI native code under src/vs/ai/ with a unified provider interface; minimize upstream VS Code core edits."
last_updated: "2026-07-22"
status: accepted
---

# ADR 0001: AI Layer Isolation and Multi-Provider Architecture

## Context

FewStepsAway is a VS Code fork whose product value is **native AI** (inline completion, chat, agent modes, indexing, refactoring assist) — not a bolt-on extension. Upstream VS Code moves quickly; scattering AI logic across `src/vs/workbench`, `src/vs/editor`, or `src/vs/platform` would make merges painful and blur the boundary between stock editor behavior and product code.

Teams also need **provider freedom**: OpenAI, Anthropic, Google, AWS, OpenRouter, and local models must plug in without rewriting chat, completion, or indexing for each vendor.

## Decision

1. **Isolation boundary** — All FewStepsAway AI product code lives under **`src/vs/ai/`** (providers, context, indexing, completion, chat, agent, tools, auth client). Prefer VS Code extension points (services, commands, configuration contributions) over editing core modules. Any unavoidable core change must be documented in the PR and, when architectural, in a follow-up ADR.

2. **Provider abstraction** — Every external model vendor implements **`IAIProvider`** (`src/vs/ai/provider/`): capabilities metadata, `sendRequest`, optional `streamRequest`, model listing, and lifecycle hooks. Registration goes through a central provider registry — routes and UI never call vendor SDKs directly.

3. **Layering inside `src/vs/ai/`** — Presentation (chat panel, inline widgets) calls services; services call providers and shared libs (context manager, indexing). Follow VS Code DI (`@IServiceName`), `Disposable` + `_register()`, and `Emitter`/`Event` patterns per [AGENTS.md](../../AGENTS.md).

4. **Platform split** — Identity, billing, org policy, and audit for enterprises live in the sibling **fewstepsapp** platform repo. The IDE consumes platform APIs (e.g. PKCE auth) via `src/vs/ai/auth/` and documented HTTP contracts — not by duplicating platform business logic in the fork.

## Consequences

- **Positive:** Clear merge surface with upstream; new providers are additive; agents and contributors have one directory to search.
- **Positive:** Multi-provider routing, rate limits, and fallbacks stay centralized in the AI service layer.
- **Negative:** Some UX that feels "editor-native" may require thin integration shims at the workbench boundary rather than inline core patches — accept that trade-off.
- **Follow-ups:** Per-provider ADRs only when a vendor needs exceptional handling (e.g. local-only mode, air-gapped deploy). Detailed phased delivery remains in [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) and [ROADMAP.md](../ROADMAP.md).

## References

- [AGENTS.md](../../AGENTS.md) — coding standards and `src/vs/ai/` layout
- [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) — phased feature plan
- [architecture/system-architecture.md](../architecture/system-architecture.md) — system diagram
- [specifications/features/ai-providers.md](../specifications/features/ai-providers.md) — provider feature spec
