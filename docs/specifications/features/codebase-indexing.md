---
title: "Feature: Codebase Indexing"
description: "Semantic and hybrid codebase search for AI context."
last_updated: "2026-07-22"
---

# Feature: Codebase Indexing

## Status

- Phase: 1
- State: **shipped (engineering)**
- Code: `src/vs/ai/indexing/`

## Overview

Workspace indexing with embeddings, semantic index, hybrid search, and codebase search tool for the agent.

## Acceptance criteria

- [x] Indexing contribution on workspace open/change
- [x] Embedding service + semantic index
- [x] Hybrid search (`hybridSearch.test.ts`)
- [x] `codebaseSearchTool` for agent
- [ ] 100K+ file scale benchmarks documented — product gate per platform PRD

## Tests

`src/vs/ai/indexing/hybridSearch.test.ts`
