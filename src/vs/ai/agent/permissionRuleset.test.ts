import { describe, expect, test } from "bun:test"
import { evaluatePermission, codeRuleset } from "../mode/permissionRuleset.ts"
import type { PermissionRuleset } from "../mode/permissionRuleset.ts"

describe("evaluatePermission", () => {
  const ruleset: PermissionRuleset = {
    default: "ask",
    rules: [
      { tool: "read", verdict: "allow" },
      { tool: "bash", verdict: "deny" },
      { tool: "write", verdict: "ask" },
    ],
  }

  test("allows read", () => {
    expect(evaluatePermission(ruleset, "read", {})).toBe("allow")
  })

  test("denies bash", () => {
    expect(evaluatePermission(ruleset, "bash", {})).toBe("deny")
  })

  test("asks for write", () => {
    expect(evaluatePermission(ruleset, "write", {})).toBe("ask")
  })

  test("code ruleset denies apply_patch on .env", () => {
    expect(evaluatePermission(codeRuleset, "apply_patch", { filePath: ".env" })).toBe("deny")
    expect(evaluatePermission(codeRuleset, "apply_patch", { filePath: "src/index.ts" })).toBe("allow")
  })
})
