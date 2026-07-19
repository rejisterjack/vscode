# Ecosystem Expansion (Phase 4)

## Extension API

Third-party tools and context providers register via `IAIExtensionApi`:

- `src/vs/ai/extension-api/aiExtensionApi.ts`
- `registerTool()` — add agent tools
- `registerContextProvider()` — contribute chat context snippets

## Planned clients

| Client | Status | Notes |
|--------|--------|-------|
| VS Code fork (fewstepside) | Shipped | Primary IDE |
| JetBrains plugin | Planned | LSP + platform OAuth |
| Neovim | Planned | `fewstepsaway.nvim` + headless CLI |
| Global compliance | Partial | Platform audit + policy engine |

## Compliance hooks

- AI audit logs: `POST /api/v1/ai-audit`
- Policy evaluation: `POST /api/v1/policies/:orgId/evaluate`
- Security pre-flight: `POST /api/v1/security/preflight`
