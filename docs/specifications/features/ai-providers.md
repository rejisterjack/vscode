---
title: "Feature: AI Providers"
description: "Multi-provider LLM abstraction for FewStepsAway IDE."
last_updated: "2026-07-22"
---

# Feature: AI Providers

## Status

- Phase: 1
- State: **shipped (engineering)**
- Code: `src/vs/ai/provider/`

## Overview

Unified `IAIProvider` registry with streaming, model selection, and protocol adapters (OpenAI chat/responses, Anthropic messages, Gemini, etc.).

## Acceptance criteria

- [x] OpenAI, Anthropic, Google/Gemini, OpenRouter, Ollama, Bedrock, Azure, xAI, Z.ai, Kilo, OpenAI-compatible profiles
- [x] Provider registry + contribution wiring (`providers.contribution.ts`)
- [x] Rate limiting helper (`common/rateLimiter.ts`)
- [x] Test provider for unit tests
- [ ] Provider failover chains — partial (`providerOrder.ts`); product default TBD

## Out of scope

- Platform-side inference routing (fewstepsapp)
