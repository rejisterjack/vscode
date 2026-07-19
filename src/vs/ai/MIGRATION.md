# Native AI Migration Status

The legacy `extensions/fewstepsaway-ai` extension is **disabled at startup** by
`disableLegacyExtension.contribution.ts`. The CLI binary remains for headless use.

## Migrated to native (`src/vs/ai` + `workbench/contrib/aiChat`)

| Feature | Native location |
|---------|-----------------|
| Agent loop + tools | `src/vs/ai/agent/`, `src/vs/ai/tool/` |
| Chat UI | `workbench/contrib/aiChat/` |
| Providers | `src/vs/ai/provider/` |
| Modes | `src/vs/ai/mode/` |
| Tab / NES autocomplete | `src/vs/ai/suggestion/` |
| Platform OAuth | `src/vs/ai/auth/` |
| @mentions | `src/vs/ai/common/mentionParser.ts`, `contextManager.ts` |
| Local indexing | `src/vs/ai/indexing/` |
| MCP bridge | `src/vs/ai/mcp/` |
| Composer | `src/vs/ai/composer/` + `composerDock.ts` |
| Rate limiter | `src/vs/ai/common/rateLimiter.ts` |

## Still extension-only

- Headless CLI binary (`extensions/fewstepsaway-ai/bin/`)
- Legacy webview panels (disabled)
