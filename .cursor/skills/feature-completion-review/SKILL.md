---
name: feature-completion-review
description: Step-by-step procedure for explicit "review" / "final review" / "in-depth review" / "is this done?" requests on an already-implemented feature. Use whenever the user asks to review a completed feature, NOT for ongoing implementation work. Enforces the definition-of-done rule (02-definition-of-done-and-review-discipline.mdc) to prevent the endless-development-loop failure mode.
---

# Feature Completion Review

This skill is the operational companion to `.cursor/rules/02-definition-of-done-and-review-discipline.mdc`. It exists to stop the LLM failure mode where a "review" request triggers a stream of manufactured must-fix items, pushing the user into an endless development loop on an already-complete feature.

## When to use this skill

Trigger phrases: "review", "final review", "in-depth review", "is this done?", "anything left?", "ready to merge?", "can we ship this?"

Do NOT use this skill for ongoing implementation work — if the feature is still being built, keep building. This skill is only for evaluating whether already-implemented work is complete against its original scope.

## Steps

1. **Recover the original scope.** Find and re-read:
   - The conversation's plan/todos.
   - The implementation plan (`docs/IMPLEMENTATION_PLAN.md`) and any design specs in `docs/`.
   - The user's explicit requirements in the conversation thread.

   If the scope is genuinely unclear after this, **stop and ask the user** what the planned scope was. Do not silently assume a broader scope.

2. **Run the relevant verification steps** for this repo: type-check (`npm run compile` or the repo's compile script), lint (`npm run eslint`), and the relevant tests (`npm run test-node` / `npm run test-ai` per `20-testing.mdc`). Skip steps that don't apply to the feature's surface area.

3. **Check edge cases against the testing expectations** in `20-testing.mdc`:
   - Unit tests cover the core logic branches?
   - Integration tests cover the relevant interactions (e.g. provider ↔ AI service ↔ context manager)?

   Missing tests for scenarios that were **part of the original ask** = Blocking. Missing tests for scenarios that were **not** part of the original ask = Optional.

4. **Classify every finding as Blocking or Optional:**
   - **Blocking**: real bugs, unmet spec requirements, unhandled edge cases from the original ask, security risks, failing existing tests.
   - **Optional / future**: anything outside original scope, style nits, speculative enhancements, "we could also add…", non-required refactorings.

5. **Render a clear verdict.** One of:
   - **"This feature is complete — it matches the planned scope and passes the testing bar."** (Use this when nothing Blocking was found. Do not bury this verdict under a pile of optional suggestions.)
   - **"This feature is not complete — [list of Blocking items]."** (Fix the Blocking items, then re-evaluate.)

6. **List Optional items separately**, clearly labeled as optional, at the end. Do not implement them. Do not imply they are required. The user must explicitly ask for a new feature or enhancement before you implement any Optional item.

## Anti-pattern (what NOT to do)

```
User: "Do a final review of the Anthropic provider feature."
Assistant: "I reviewed it. Here are 12 things we should add:
  1) add streaming
  2) add retry logic
  3) refactor the provider registry
  4) add a settings panel
  5) add token usage tracking
  6) ..."
```

If the planned scope was "add an Anthropic provider implementing the IAIProvider interface," and it does that and passes its tests, the correct response is:

```
Assistant: "The Anthropic provider feature is complete — it matches the planned
scope (implement IAIProvider for Anthropic) and the unit tests pass. No blocking
issues found.

Optional future enhancements (only if you want them):
- Add streaming support (currently request/response only)
- Add automatic retry with exponential backoff
- Add token-usage tracking/telemetry"
```

## Important

This skill does **not** suppress honest bug-finding. A genuine bug — even one the user didn't explicitly ask about — is still Blocking if it breaks the feature or causes incorrect behavior. The skill is about **calibration**: report real problems, don't manufacture them.
