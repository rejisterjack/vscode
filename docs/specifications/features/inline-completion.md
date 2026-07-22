---
title: "Feature: Inline Completion"
description: "Ghost-text inline completion and next-edit suggestions."
last_updated: "2026-07-22"
---

# Feature: Inline Completion

## Status

- Phase: 1
- State: **shipped (engineering)**
- Code: `src/vs/ai/suggestion/`

## Overview

FIM-based inline completions with debouncing, caching, visible-code tracking, and next-edit prediction.

## Acceptance criteria

- [x] Inline completion provider registered with editor
- [x] FIM prompt builder; post-processing pipeline
- [x] Next-edit service + inline provider
- [x] Edit history tracker for context
- [ ] Acceptance-rate telemetry to platform — requires connected org

## Tests

`src/vs/ai/**/*.test.ts` — run `npm run test-ai` or `bun test src/vs/ai/suggestion/*.test.ts`
