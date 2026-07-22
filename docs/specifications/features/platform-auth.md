---
title: "Feature: Platform Auth"
description: "OAuth2 PKCE sign-in to FewStepsAway platform from the IDE."
last_updated: "2026-07-22"
---

# Feature: Platform Auth

## Status

- Phase: 1
- State: **shipped (engineering)**
- Code: `src/vs/ai/auth/`, `src/vs/ai/backend/`

## Overview

IDE authenticates to the FewStepsAway platform via PKCE; tokens used for backend API calls (AI proxy, audit, policies).

## Acceptance criteria

- [x] PKCE flow (`fewStepsAwayPkce.ts`)
- [x] Auth service + API client (`fewStepsAwayAuthService.ts`, `fewStepsAwayApiClient.ts`)
- [x] Backend connection + SSE client for streaming (`backend/`)
- [ ] Offline-only mode without platform — supported via direct provider keys; enterprise default TBD

## Cross-repo

Platform OAuth AS: `fewstepsapp/apps/backend/src/routes/oauth.ts`
