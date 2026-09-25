# Develop and verify in Muxy

Use this workflow for panel UI, host integration, runtime behavior, and manifest changes. Completion requires the changed behavior working in the real Muxy app and test resources cleaned up. A browser fixture is useful during development; native WebKit fixtures and Node process tests cover their own seams. The Muxy check exercises extension loading, permissions, active-worktree file access, terminals, and the host browser together.

## 0. Establish the contract before editing

Describe the user-visible before/after behavior and the affected module boundary from [Architecture](ARCHITECTURE.md). For a bug fix, reproduce the failure through the relevant existing test seam or native flow. Define the observation that will demonstrate the fix, including the relevant denial, stale-context, or recovery case.

Read the upstream references for the branches the change touches:

| Change | Reference and required decision |
| --- | --- |
| Host API call | Find the method in the [official extension docs](https://muxy.app/docs/extensions/get-started). Verify its signature, return/error shape, availability in a panel's `window.muxy`, execution-host scope, and [permissions/consent](https://muxy.app/docs/extensions/permissions). |
| Manifest or permissions | Read [Manifest](https://muxy.app/docs/extensions/manifest), the affected contribution's page, and the schema referenced by `package.json`. Tie each added permission to the call that requires it. The distribution check verifies project packaging rules; check changed fields against the schema as well. |
| Appearance | Read the Theme and Sizing sections of the [official muxy-extension skill](https://github.com/muxy-app/muxy/blob/main/Muxy/Resources/skills/muxy-extension/SKILL.md). Apply theme tokens and scale through the existing stylesheet; keep changed UI copy in both language dictionaries. |
| Focus, events, or panel lifetime | Read [Panels](https://muxy.app/docs/extensions/panels), [Events](https://muxy.app/docs/extensions/events), and [Lifecycle](https://muxy.app/docs/extensions/lifecycle). Identify which state survives hiding, closing, and project switching, and which in-flight work must be invalidated. |

The official skill also points to [llms.txt](https://muxy.app/llms.txt) and raw Markdown at a docs URL plus `/plain`. If those endpoints are unavailable, use the normal documentation page or its **Edit this page on GitHub** source link. Keep API inventories upstream; the repository's manifest, build configuration, and architecture define Run Deck's implementation.

Record the installed Muxy version and compare it with the tested baseline in [Validation](VALIDATION.md). Current upstream docs can describe newer host capabilities. Verify a newly used capability in the target host; a fake adapter implementing it establishes only the fixture's behavior. When support is unresolved, finish independent work and name the missing capability and native check in the report.

**Done:** the changed behavior has an observable acceptance condition; each changed host call or manifest field has a source-backed contract; compatibility assumptions and required native cases are identified. Keep these task-specific notes with the change's verification evidence.

## 1. Build the intended checkout

Inspect `git status` and the active checkout. Preserve concurrent work and use the existing scripts in `package.json`; install dependencies with `npm ci` if needed, then run `npm run check`. Read the command result before continuing.

**Done:** checks pass, and `dist/package.json`, `dist/panel/index.html`, and the assets referenced by that HTML exist. Record the checkout and generated asset filename/hash in the verification note. Rebuild after further runtime edits.

The unpacked extension root is **`dist/`**. It contains the installable manifest and compiled panel. The source `panel/index.html` imports source JavaScript/CSS for Vite; a Vite server does not replace the installed extension. Resolve the absolute `dist/` path from the current checkout each time.

## 2. Load or reload that build

Use the available native-app tool. With Codex Computer Use, select Muxy with `cua.getApp('com.muxy.app')`, inspect its current accessibility state, then click **Extensions** (`puzzlepiece.extension`). Read fresh state after each action; element indices and window coordinates are temporary.

A native accessibility click can be dispatched without focusing the embedded web panel. If the focused element remains a terminal and the expected UI change is absent, inspect a fresh screenshot and click the visible panel control by its current coordinates. Verify the resulting state before continuing; keep tool indices and coordinates out of reusable instructions.

Choose the applicable branch:

| Installed state | Action and completion criterion |
| --- | --- |
| Run Deck is absent | Choose **Load Unpacked**, select the absolute `dist/` directory, and complete the host's load flow. In a macOS folder chooser, **⌘⇧G** enters the absolute directory; confirm navigation, then confirm selection. Finish when Run Deck appears and is enabled. |
| Run Deck is already loaded from this checkout | Open its extension details and verify the displayed path is this checkout's `dist/`. Return to the extension list and click **Reload** (help: “Reload Extensions”). |
| Run Deck is loaded from another checkout or a release | Use **Load Unpacked** for the intended `dist/`, inspect any replacement prompt, and verify the path in extension details afterward. Preserve saved commands and permission rules. If the host requires an unresolved installation change, report that exact decision. |

The Reload toolbar action may rebuild extension UI without changing the Installed list. Close the manager with its Close button or **Escape**, then reopen Run Deck from its topbar icon or **Run Deck: Toggle Services**. A reload may close the old panel; reopen it before diagnosing a missing panel as a load failure.

**Done:** extension details show the intended absolute `dist/` path and enabled state; the panel is served at `muxy-ext://run-deck/panel/index.html`; a loaded asset identifier, change-specific visible behavior, or host diagnostic ties the running panel to the build from step 1. A matching version number alone is insufficient because local builds retain the package version.

If loading fails, use the extension detail's **Logs → Show / Reveal Log** or the **Extension Output** toolbar button. Verify the manifest and referenced build files, correct the cause, rebuild, and reload. Keep diagnostics scoped to Run Deck.

## 3. Exercise the affected flow

Select the intended project/worktree in Muxy. Expand **Working directory / 工作目录** in the command dialog and check the worktree path before executing anything. Use the panel's Refresh to obtain a current observation; honor its paused/live state.

For a known development/test operation already authorized by the task, inspect Muxy's consent sheet and choose one-time **Allow** when it matches the intended scan, test command, or test-process stop. Preserve existing remembered rules. Requests that introduce new authority or involve unrelated resources need the corresponding user decision. If permission is denied, report the denied operation and verify the resulting error/recovery state.

For each changed interaction, perform its primary action and its relevant failure/recovery path. UI changes include native theme, narrow panel layout, labels, keyboard dismissal, and focus return. Launch/terminal/browser/stop changes use the disposable service below. Restart, worker-tree, consent-race, and resource-observation changes additionally exercise their specific cases from [RELEASE.md](../RELEASE.md#native-smoke-test).

### Disposable service

In the run-deck worktree, open **Start command → Custom command** and use:

```sh
node scripts/muxy-smoke-server.mjs
```

Set a unique test name in More options and leave the directory as `.`. This helper serves a diagnostic response on a free loopback port and prints its PID and URL. Record both from the actual terminal; the OS selects a different port each run.

1. **Start:** click Save & start, inspect and allow the matching one-time terminal request. Done when terminal output reports a PID/URL and a refreshed Run Deck row shows the unique name, matching port, and Run Deck association. If focus moved to consent or a terminal, return to the panel and Refresh.
2. **Terminal:** select a different existing tab, then use the test row's Terminal action. Done when Muxy selects the exact test terminal and its output. Keep a record of the pre-existing tab selection for restoration.
3. **Open:** use the test row's Open action. If prompted about the execution host, verify it before accepting. Done when Muxy's browser displays “Run Deck native smoke test” and the recorded PID at the recorded URL. An independent HTTP request can supplement this observation.
4. **Stop:** use the test row's Stop action and allow only the matching verified test-process request. Done when Refresh removes the row, the recorded listener is gone, and the recorded test process has exited. Inspect Details for wrapper/member PIDs when verifying tree behavior. Use read-only `lsof`/`ps` checks for confirmation; preserve unrelated listeners.

**Done:** every affected operation has an observed result, with expected and actual behavior recorded. A discovered script, opened terminal, or green test suite alone does not demonstrate a successful native service flow.

## 4. Clean up and report

Close only the test-created terminal/browser tabs and remove only this run's saved test command through the command menu. Restore the previous project/tab selection and any preferences changed for testing. The smoke helper remains in the repository for future runs; its server process must exit. Keep user-owned services and saved commands intact. If test cleanup is blocked, identify the exact remaining resource and reason.

**Done:** no test-owned listener/process remains, the temporary saved command and tabs are removed, and a final Muxy view shows the intended build. Report the checkout/build identifier, Muxy version, contract sources for changed host calls/fields, passed checks, actual native actions/results, cleanup, and any unresolved blocker. Store durable evidence in [VALIDATION.md](VALIDATION.md), clearly scoped to the tested build; keep private paths/terminal screenshots out of public listing assets.

When the app or native tools are unavailable, finish the independently testable work and state which native step could not be completed and why. Resume the native workflow when access returns. Hand the user only the unavoidable action, rather than an entire unattempted installation checklist.
