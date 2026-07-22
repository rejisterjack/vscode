---
title: "Feature: Chat & Agent Modes"
description: "Chat panel, streaming, modes, agent loop, and tools."
last_updated: "2026-07-22"
---

# Feature: Chat & Agent Modes

## Status

- Phase: 1
- State: **shipped (engineering)**
- Code: `src/vs/ai/chat/`, `agent/`, `mode/`, `tool/`, `mcp/`, `composer/`

## Overview

Multi-mode chat (ask, plan, debug, …) with streaming, tool execution (read/write/grep/bash/web search/apply patch), MCP bridge, composer multi-hunk edits, and background agent service.

## Acceptance criteria

- [x] Chat streaming (`chatStreaming.ts`)
- [x] Mode registry + prompts (`mode/`)
- [x] Agent loop with permission gates (`agent/agentLoop.ts`)
- [x] Tool registry + contributions (`tool/`)
- [x] MCP tool bridge (`mcp/mcpToolBridge.ts`)
- [x] Composer apply flow (`composer/`)
- [x] Review findings service (`review/`)
- [ ] Enterprise policy blocking tools by default — platform policy integration partial

## Out of scope

- PR review posting to GitHub (platform worker in fewstepsapp)
