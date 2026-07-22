---
name: write-tests
description: Decide the right test level and write tests using this repo's Mocha/bun:test conventions. Use when the user asks to add tests, write a test for an AI module, or improve coverage.
---

# Writing Tests

Follow `.cursor/rules/20-testing.mdc` for naming, layout, mock-provider patterns, and required commands.

## Pick the level

- **Unit** — colocated `{module}.test.ts` next to the code under `src/vs/ai/`. Mock external AI HTTP; don't hit live providers in CI.
- **Integration** — `src/vs/ai/test/integration/` for service wiring with the test harness (`app.get(IService)`).
- **Core VS Code** — `npm run test-node` for platform/workbench changes outside `src/vs/ai/`.

## Commands

- AI modules: `bun test src/vs/ai/**/*.test.ts src/vs/ai/tool/tools/*.test.ts` (see `package.json` `test-ai` script).
- General unit: `npm run test-node`
- Browser: `npm run test-browser` when DOM is required
- Lint gate: `npm run eslint` — a change isn't done until lint passes for touched files.

## TDD

Write the failing test first for new behavior; for bugs, add a regression test before the fix. Never commit `.only` / `.skip`.
