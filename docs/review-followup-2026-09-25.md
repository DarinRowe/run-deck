# Follow-up joint review — 2026-09-25

This pass started from the existing uncommitted [joint-review changes](review-2026-09-25.md), with 124 passing tests. The primary agent and three independently scoped reviewers examined command/discovery lifetimes, process/service actions, and UI/observation memory. Existing changes and evidence were preserved. A second, read-only cross-review examined the service-action repairs.

## Confirmed defects

| Defect | Reproduction and repair |
| --- | --- |
| Confirmation outlives the observation | Invalidate the workspace while Open or an outside-project Stop awaits confirmation, leaving the host's context response unchanged. Previously the old action continued. Preserve the selected observation generation through confirmation and preflight, including Restart's stop callback. |
| Actions bypass a pending scan | Start a quiet scan, request Open or Terminal, then fail the scan. Previously the old row could still navigate. Both actions now await the scan and validate its resulting state. |
| An automatic scan escapes the foreground scheduler | An automatic request reaches a pending Stop, finishes its scheduler job, then the panel hides before Stop completes. Previously Stop's deferred refresh scanned while hidden. Automatic requests no longer enter that separate deferred queue; explicit refresh retains its behavior. |
| Cancelled discovery continues reading | Cancel, dispose, or emit a workspace event during the initial or final project lookup. Previously the next worktree read was still dispatched. Check cancellation and workspace version between context reads. |
| Old discovery survives a workspace event | Delay a file response, invalidate the workspace, and refresh back to the same context. Previously equality of paths allowed the old response. Retain the event version across the whole discovery operation. |
| Missing CPU data produces a misleading trend | SVG `.hidden` did not reflect an HTML attribute, so the chart remained visible with one sample or unknown CPU. Toggle the actual attribute only when its value changes. The browser regression checks computed visibility, valid samples, missing values, gaps, and recovery. |
| A dead panel can still request confirmation | Dispose while Open waits for a scan or remembered-host lookup, or invalidate during that lookup. The cross-review reproduced a late confirmation even though navigation was eventually rejected. Reject disposed targets and check invalidation before prompting, without another host read. |

No shell signalling changes, new runtime dependencies, DOM caches, or background polling were introduced. The process-tree and parser review found no further reproducible defect requiring a repair. This is a bounded audit, not a claim that every possible race is eliminated.

## Verification

- Final `npm run check`: **139 passed, zero failed or skipped**, including native macOS process integrations, build, and distribution assertions. Fifteen Node regression cases were added in this pass. Reviewers ran failing cases before repairs; the additional Terminal test uses a real Launchpad/token association through the fake host. The SVG regression failed against the old source and passed against source and the final minified bundle.
- Checkout: `codex/service-dashboard`, `/Users/darinlo/Documents/Projects/run-deck`. Final bundle: **79.9 KiB HTML/JS/CSS**, 12 files. JS `index-BbqimWpD.js`, SHA-256 `e6a05b0f4b4905341154c182eec8c834089f0f25b9103dd9efef8f09c49c8fcc`; CSS `index-BrTUVwqA.css`, SHA-256 `2ffcf0e5353353412bd9f79b330b7a2380cdfbc27cd2427d742579b217608eb2`. The JS hash remained unchanged through native verification.
- Final production preview passed trend visibility, hidden events, hidden preflight, same-port history and concurrent URL forms, discovery close/reopen, close during refresh, live resumption before an old file reply, and pending-launch exclusion. A pending launch produced exactly one terminal and blocked dismissal. Closed discovery issued no later reads or detached-dialog mutations.
- The 200-service / 6,000-process UI retained **4,472 elements**; search and unchanged refresh created **zero elements**, unchanged cards produced **zero mutations**, open details reused rows and preserved URL drafts, and closing details released their body. Search median/p95 was **0.9/7.0 ms**; including synchronous layout, **10.5/16.8 ms**. The p95 includes an outlier; timings are observations, not portable gates or evidence of a speedup.
- Hidden event bursts produced zero reads/scans/mutations; foreground recovery made three command reads, one tab-list request, and one scan. Hiding during preflight produced no shell scan; explicit refresh recovered with one scan.

## Performance and memory

Standalone Node benchmark on the same machine:

| Fixture | Starting median / p95 | Final median / p95 |
| --- | --- | --- |
| 20 services / 200 processes | 0.41 / 0.76 ms | 0.40 / 0.85 ms |
| 200 services / 6,000 processes | 9.35 / 11.93 ms | 9.68 / 14.28 ms |

The first final benchmark overlapped the test suite and was excluded from this timing comparison; the final run above was performed after checks completed. These single paired runs do not establish a reliable speed change. The parsing/history workload is unchanged by this pass. Large-fixture retained heap after two forced-GC batches was **8,824,256 / 8,823,880 bytes**. The final distinct-scan regression retained **349,160 bytes (~0.33 MiB)** across 200 different 6,000-process scans.

No new unbounded UI or history retention was confirmed. The cancellation fixes reduce unnecessary work and suppress late prompts. They do not demonstrate a reduction in total Muxy/WebKit memory. The earlier [WebKit attribution limits](webkit-memory/attribution/README.md) remain applicable; no additional long soak or claim to fix that peak is made.

## Native Muxy verification

Extension details confirmed the enabled DEV installation at the intended absolute `dist/` path. Extensions → Reload loaded the final build, reopened at `muxy-ext://run-deck/panel/index.html`. Start command displayed the correct worktree and discovered scripts; Escape returned focus to Start command, and reopening loaded normally.

1. Saved **Review followup 0925**, running `node scripts/muxy-smoke-server.mjs`, with one-time Allow. Wrapper/server PIDs **63461/63462**, port **59596**, matched the named Run Deck row. From the original terminal, Terminal selected the test terminal; Open displayed the smoke response and PID 63462 in Muxy's browser.
2. Cancelled the restart stop permission. Actions became disabled with an error; independent `ps` and HTTP checks confirmed the original service still ran. Manual Refresh recovered actionable state. In the native light panel, the first new sample after the observation gap had no trend chart, confirming the final SVG behavior.
3. Retried Restart with one-time Allow. Independent `ps`/`lsof` checks confirmed both old PIDs and port 59596 were absent before replacement startup was authorized. One guarded replacement appeared with wrapper/server PIDs **65108/65129**, port **59856**, and the same command name. Terminal from the old test tab selected the new terminal and PID.
4. Stop requested only the replacement's verified identities and port. One-time Allow removed the row. Both terminal outputs reported shutdown; independent checks found none of the four test PIDs or two listeners.
5. Removed the temporary saved command, closed its two terminals and one browser tab, and restored the original terminal, empty search, and enabled live checks. Existing commands, sort order, language, and permission rules were retained. The isolated browser TaskSpace was finished and the port-5198 Vite process stopped. This run left no test-owned process, listener, command, or tab.

The native flow covers normal actions, consent denial/recovery, restart ordering, and the changed visual behavior. Delayed invalidation/disposal races and missing-CPU data were tested with deterministic adapters rather than native fault injection. The separate helper-cleanup limitation from the earlier review was not changed or counted as a resource created by this pass.

## Reproduction

Run `npm run check` for the Node suite, native macOS process tests, production build, and distribution checks. Run `npm run benchmark` and `node --expose-gc scripts/benchmark-history-memory.mjs` separately from other CPU-heavy tests.

Serve the repository, open `/tests/preview.html?build=1`, and run the exported checks from `tests/ui-observation.mjs`, `tests/performance.mjs`, and `tests/starter-lifecycle.mjs`. Reload between independent fixtures. These checks use the fake Muxy adapter; they do not exercise native permission sheets or prove real multi-window timing behavior. Follow [MUXY-DEVELOPMENT.md](MUXY-DEVELOPMENT.md) for actual host verification and cleanup.
