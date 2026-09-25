# Performance re-audit: closed command dialogs

Validated on 2026-09-24 (America/Los_Angeles), with Node 22.22.2, Chromium, and a native WKWebView. This is a follow-up to the [history-memory audit](README.md).

## Finding

Closing Start command did not end its background loading lifecycle. A delayed command refresh could populate a detached dialog and start unnecessary script discovery. A delayed discovery continued through file stat/read after closing. Its shared mutation lock returned `undefined` to a newly opened dialog, causing a `.find` error and leaving Launch disabled. Meanwhile, the original async button action kept the global live-check hold until the old request finished.

The reproduction delays the fake host at an actual asynchronous read, closes the real UI, and releases the response or opens another dialog. It exercises production code through DOM events and the injected host interface.

| Scenario | Before | After |
| --- | --- | --- |
| Close during saved-command refresh | 1 subsequent directory read; 3 detached-dialog mutations | 0 directory reads; 0 mutations |
| Close during directory listing, then release its response | Still issued stat and file read | Neither issued |
| Reopen while old list/stat/read is pending | `.find` error; Launch stays disabled | New dialog ready before old response; no stale follow-up reads |
| Close while discovery is pending, with live checks enabled | 0 scans within 6.5 seconds in Chromium, despite enabled live mode | Next periodic scan completes before old discovery response |

## Change

`Launchpad.discover({ signal })` is a read-only operation with cancellation and context/disposal checks between read phases. It no longer uses the mutation exclusion mechanism. Launch, Stop, Restart, and persistence retain their existing guards.

The command dialog owns its cancellation signal and cancels on dismissal. Loading checks that the dialog is still current before creating saved rows, reading files, or displaying a result/error. Opening the dialog returns immediately; the open dialog itself holds live checks, so an obsolete background load no longer holds them after closure. No cache, dependency, or new production module was introduced.

Already dispatched Muxy requests cannot be cancelled through this interface. They may remain pending until the host responds; cancellation prevents subsequent reads and ignores obsolete results. This is not evidence of immediate reclamation of every pending-request allocation.

## Verification

- Seven new module regressions failed before the fix and pass afterward: cancellation at list/stat/read, pre-cancellation, independent reopening, disposal, and workspace changes.
- `npm run check` at the checkpoint passed **75 tests**, none skipped, including real macOS process integrations and the distinct-snapshot memory regression. Build and distribution checks passed: 12 files, 72.6 KiB HTML/JS/CSS. [Checkpoint log](lifecycle/check.log).
- Chromium exercised the minified production bundle. [Before](lifecycle/before-ui.json) and [after](lifecycle/after-ui.json) include actual read and mutation counts. Duplicate submit and dismissal during pending launch also retained their protections: one launch, dismissal blocked.
- Native WebKit reproduced the stale file work and reopen errors. The fixed immutable build passed all six UI checks, including live recovery and launch protection, then **20 additional close/reopen cycles** with no browser errors. This uses synthetic Muxy data, not the real Muxy bridge. [Before native log](lifecycle/native-before.ndjson), [after native log](lifecycle/native-after.ndjson).
- Native baseline scheduler/launch checks timed out when foreground rendering changed; these timeouts are not used as independent timing evidence. Earlier harness attempts also started before the asynchronous fixture finished loading or toggled live mode twice before rendering settled. The retained test now waits for readiness and completion of the toggle; only completed post-fix assertions are counted.
- Existing production browser checks passed: hidden events and hidden preflight produced zero subsequent scans; recovery issued one scan. At 200 services / 6,000 processes, search and unchanged refresh created zero elements, unchanged cards had zero mutations, expanded rows were reused, edited URLs survived, and closed details were released. [Results](lifecycle/performance-ui.json).

The data benchmark remained bounded in this run: 200 services / 6,000 processes took 10.36 ms median / 15.51 ms p95 for parse + group + history; retained heap after two GC batches was 8,792,704 / 8,799,240 bytes. Browser search measured 0.9 ms median / 10.7 ms p95 in JavaScript and 10.8 / 22.7 ms including synchronous layout. These are single-run observations under concurrent desktop activity, not before/after speedup evidence. The production scan/parser/history paths were not changed in this pass.

**No WebKit footprint/RSS reduction is established by this audit.** The previous [35-minute soak](../webkit-memory/README.md), including its 1.03 GiB sampled footprint peak, remains the relevant long-duration evidence. This lifecycle check neither repeats that workload nor resolves that peak.

The [change patch](lifecycle/change.patch) isolates this audit's production edits from the other uncommitted work. [Hashes](lifecycle/manifest.json) identify the frozen native bundles and source. The [original UI assertions](lifecycle/starter-lifecycle-verified.mjs) are also retained because a concurrent command-dialog redesign changed the live test selectors.

A final frozen snapshot incorporating those concurrent changes passed **82 tests**, none skipped, plus build/distribution checks (12 files, 77.5 KiB HTML/JS/CSS): [log](lifecycle/current-check.log). Its native close-during-refresh and all three reopen/read-cancellation checks passed. The subsequent live/launch assertions timed out after the native window lost foreground, so that run supplies no additional evidence for those two cases; the earlier fixed snapshot passed both. [Integrated native log](lifecycle/native-current.ndjson). All three native host processes recorded in the manifest exited. The shared workspace may continue changing after these frozen checkpoints.

## Reproduce

```sh
node --test tests/discovery.test.mjs
npm run check
npm run dev
```

Open `/tests/preview.html?build=1`, then import `/tests/starter-lifecycle.mjs`. Run `checkStarterClosedDuringRefresh()`, `checkStarterReopen('list')`, `checkStarterReopen('stat')`, `checkStarterReopen('read')`, `checkStarterResumesLive()`, and `checkStarterLaunch()`. Use a fresh fixture for independent checks.

For native verification, use a temporary copy of the repository and its built distribution. Place the archived [probe](lifecycle/lifecycle-probe.mjs) at `tests/webkit-soak.mjs` **in that copy**, serve it on localhost, and run the host built from `scripts/webkit-memory.swift` against `/tests/preview.html?build=1` with a duration argument of 45. It finishes after its assertions and 20 additional cycles. Do not overwrite the normal soak fixture in the working repository.
