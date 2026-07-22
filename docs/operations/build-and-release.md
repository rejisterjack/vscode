---
title: "Build and Release"
description: "How to build, test, and ship FewStepsAway IDE releases."
last_updated: "2026-07-22"
---

# Build and Release

## Development build

```sh
npm install
npm run compile          # full VS Code compile
./scripts/code.sh        # run development build
```

AI module only:

```sh
npm run compile-ai       # if defined in package.json scripts
bun test src/vs/ai/**/*.test.ts   # AI unit tests
npm run test-node        # broader unit suite
```

## Pre-release checklist

- [ ] `npm run eslint` clean on touched `src/vs/ai/**` paths
- [ ] AI tests pass (`bun test src/vs/ai/**/*.test.ts` or `npm run test-ai`)
- [ ] No secrets in `product.json` / user settings samples
- [ ] Platform auth tested against staging `BETTER_AUTH_URL` (fewstepsapp)
- [ ] Release notes mention provider or agent tool changes

## Distribution

- Desktop builds follow upstream VS Code packaging patterns in `build/` and `scripts/`.
- **No committed EAS/electron-release config** in this repo snapshot — confirm release channel with maintainers before production launch.

## Upstream merge discipline

- Keep AI changes isolated under `src/vs/ai/`.
- Document any required core `src/vs/workbench` hooks in PR description ([AGENTS.md](../../AGENTS.md)).

## Related

- Platform deploy: `../fewstepsapp/docs/engineering/DEPLOYMENT.md`
- Ecosystem clients: [ecosystem/ECOSYSTEM.md](../ecosystem/ECOSYSTEM.md)
