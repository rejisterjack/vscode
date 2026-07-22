---
title: "Product Vision"
description: "North-star vision for FewStepsAway — an AI-native code editor built organisation-first for engineering teams."
last_updated: "2026-07-22"
---

# FewStepsAway — Product Vision

FewStepsAway is an **open-source, AI-native code editor** (VS Code fork) built **organisation-first** for engineering teams — not a consumer AI tool with enterprise features bolted on.

## Problem we solve

1. **Context collapse** — AI assistants degrade on large, polyglot, multi-repo codebases typical of Indian product companies and GCCs.
2. **Governance vacuum** — regulated buyers need audit trails, policy enforcement, and control over which models see which code.
3. **Onboarding failure** — institutional knowledge (ADRs, runbooks, “why”) is not in the training data of generic copilots.
4. **Technical debt blindness** — debt accumulates invisibly until delivery slows or incidents occur.

## Who we serve

- Indian product companies (Series B–D fintech, SaaS, consumer)
- Global capability centres (GCCs) in India
- IT services firms modernising delivery with governed AI

## Product split (two repositories)

| Repo | Role |
|------|------|
| **fewstepside** (this repo) | VS Code fork — inline AI, chat, agent modes, indexing, providers, platform auth client |
| **fewstepsapp** | Platform API — identity, billing, OAuth AS, AI audit, policies, org admin |

The IDE talks to the platform via OAuth2 PKCE and REST ([ecosystem/ECOSYSTEM.md](ecosystem/ECOSYSTEM.md)).

## Phase 1 — Core Intelligence (final-version target)

Shipped or in progress in `src/vs/ai/` (see [specifications/features/](specifications/features/) and [status/feature-status.md](status/feature-status.md)):

- Multi-provider AI (OpenAI, Anthropic, Google, OpenRouter, Ollama, Bedrock, Azure, etc.)
- Inline completion + next-edit suggestions
- Chat with modes (ask, plan, debug, …) and agent loop with tools
- Codebase indexing + semantic/hybrid search
- Composer multi-file edits; MCP tool bridge
- FewStepsAway platform sign-in (PKCE)

**Deferred to platform + later phases:** full Org-Brain document ingestion, enterprise SAML at IDE, JetBrains/Neovim clients, SOC 2 observation.

## Principles

- AI is **native** in the editor (`src/vs/ai/`), not an extension afterthought.
- **Minimize** changes to upstream VS Code core; document exceptions.
- **Governance** flows through the platform (audit, policies) when connected.

## Authority chain

| Doc | Role |
|-----|------|
| This file | Business narrative |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Detailed phased plan |
| [business/prd.md](business/prd.md) | Platform PRD (fewstepsapp); IDE aligns to Phase 1 section |
| [specifications/features/](specifications/features/) | Shipped feature acceptance criteria |
| [status/feature-status.md](status/feature-status.md) | Honest completion ledger |
