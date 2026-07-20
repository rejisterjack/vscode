---
name: add-vscode-setting
description: Use when adding a new user-facing toggle/setting backed by the reactive storage service — covers the reactiveStorageTypes/reactiveStorageService/settings-tab/call-site wiring end-to-end.
---

# Add a New Setting

Follow this sequence when adding a new user-facing setting that's backed by the application's reactive storage service (as opposed to a raw VS Code `contributes.configuration` entry — use that instead if the setting should show up in the standard Settings JSON/search, per `00-vscode-fork-conventions.mdc`'s docs-first policy).

## Steps

1. **Add the property to the storage type.**
   In `reactiveStorageTypes.ts`, add the new field to the relevant persistent-storage interface (e.g. `ApplicationUserPersistentStorage`):
   ```typescript
   interface ApplicationUserPersistentStorage {
       // ...existing fields...
       myNewFeatureEnabled: boolean;
   }
   ```

2. **Add a default value.**
   In `reactiveStorageService.tsx`, set the default for the new property inside `INIT_APPLICATION_USER_PERSISTENT_STORAGE`:
   ```typescript
   const INIT_APPLICATION_USER_PERSISTENT_STORAGE: ApplicationUserPersistentStorage = {
       // ...existing defaults...
       myNewFeatureEnabled: false,
   };
   ```

3. **Add the UI toggle.**
   Add the control in the appropriate settings tab component:
   - `settingsBetaTab.tsx` — for beta/experimental features.
   - `settingsGeneralTab.tsx` — for general, stable settings.

   Wire the toggle to read and write the storage property through the reactive storage service (read current value for the toggle's checked state, call the service's update/set method on change) rather than local component state, so the value persists and is available elsewhere.

4. **Read the value at the call site.**
   Wherever the feature needs to check the setting, read it off the reactive storage service:
   ```typescript
   if (vsContext.reactiveStorageService.applicationUserPersistentStorage.myNewFeatureEnabled) {
       // feature-gated behavior
   }
   ```
   Do not cache this value in a local variable that outlives a single render/handler if the setting can change at runtime — re-read it, or subscribe to storage changes, so toggling the setting takes effect without a reload.

5. **Verify.**
   - `npm run eslint` — must pass.
   - `npm run test-node` (and `bun test src/vs/ai/**/*.test.ts src/vs/ai/tool/tools/*.test.ts` if the setting gates AI-layer behavior) — must pass, including any new test covering the default value and the toggle's read/write behavior.
   - Manually verify via `./scripts/code.sh`: toggle the setting in the relevant settings tab and confirm the call site's behavior changes without a restart (unless the setting is documented as requiring one).
