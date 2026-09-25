# Validation — Service dashboard

Validated on 2026-09-24 and 2026-09-25 (America/Los_Angeles), macOS, Muxy 1.6.0, Node 22.22.2, npm 10.9.7. Dated checkpoints identify the source/build they cover. The published v0.1.0 package is the earlier command launchpad.

## 0.2.0 release verification — 2026-09-25

Final runtime commit `2d6447888aa0ba6d4dfcada98fbfa6f280e337ff` passed `npm ci && npm run check`: **141 tests**, no failures or skips on macOS, production build, and the 12-file distribution check (**80.1 KiB HTML/JS/CSS**). Its JavaScript is `index-CP7ez6MT.js`, SHA-256 `daa0b2b558e9599ff53957f2396405a60b8fbbfe4bc34fca246652e4330de9bc`; CSS is `index-BrTUVwqA.css`, SHA-256 `2ffcf0e5353353412bd9f79b330b7a2380cdfbc27cd2427d742579b217608eb2`. Subsequent evidence-only edits retain those bundle bytes.

The [first PR CI run](https://github.com/DarinRowe/run-deck/actions/runs/36111237016) passed macOS integration but exposed lost interactive stdin on all three Ubuntu jobs. A local dash regression reproduced the failure. The wrapper now saves stdin before backgrounding, passes it through a temporary descriptor, and closes that descriptor in parent and child. Both sh/dash cases and the full native tree/restart suite passed. Muxy reloaded the final 0.2.0 build from the same `dist/`; its startup consent visibly contained the new descriptor handling. A disposable `read` command echoed `portable-input-0.2.0`, and both shell PIDs 8491/8492 exited. Its temporary terminal and command record were removed, and PrintAnvil was restored.

The preceding shutdown-repair checkpoint `f006a29c2a13601a852e81cc1cdd1a873ee94f6e` passed 140 tests and exercised the full native lifecycle described below. Its tested JavaScript was `index-z4GCEM64.js`, SHA-256 `34742c35166977a8e9bf69a187f617fe0c56e6cf70500efcd5bf222ea0958ff7`. The final runtime only changes the launch wrapper's stdin transfer after that checkpoint.

Release smoke testing found a real shutdown race: after TERM to a parent, its worker briefly appeared as a zombie with a changed `comm`, causing the stop script to return 72 even though the tree was exiting. The unmodified script failed eight consecutive reproductions; a new native regression also failed before the fix. Post-signal rechecks now skip missing/zombie processes without signalling them. Initial host/membership/identity/port checks remain strict, and changed live identities still abort. All eight repetitions passed after the fix, alongside the native wrong-identity and occupied-port rejection tests.

The final native Muxy flow used a temporary two-port HTTP server with a worker that handles parent-initiated shutdown. Start created one three-member row (PIDs 92355/92356/92359, ports 61991/61992); Details showed individual resources, interactive stdin echoed correctly, Terminal selected its exact tab, and Open displayed its response in Muxy's browser. Restart removed all three PIDs and both listeners before replacement-start consent. Exactly one replacement tree appeared (94099/94126/94127, ports 62227/62228). Stop ended that entire tree successfully. The consent scripts visibly contained the new zombie check, tying the native behavior to the rebuilt runtime.

Independent `ps`/`lsof` checks confirmed all nine PIDs and six ports from the initial failed attempt and final flow were gone. All three temporary terminals, two browser tabs, the saved smoke command, and temporary helper files were removed. The three pre-existing Run Deck terminals, `dev` command, and unrelated port 5193 service remained intact. The project selection was returned to PrintAnvil. The previous checkpoint's UI and observation tests remain separately scoped below; this release reran automated coverage and the affected native lifecycle flow, not the WebKit memory soak.

## Follow-up joint review — 2026-09-25

The [follow-up review](review-followup-2026-09-25.md) preserved the existing repairs and fixed additional stale-confirmation, scan/action, foreground scheduling, discovery cancellation, and SVG visibility defects. The final **139-test** suite, native process integrations, production build, and browser regressions passed. The bundle is `index-BbqimWpD.js` (SHA-256 `e6a05b0f4b4905341154c182eec8c834089f0f25b9103dd9efef8f09c49c8fcc`).

Muxy loaded that build from this checkout's `dist/`. The temporary command `Review followup 0925` completed Start → Terminal → Open, cancelled Restart → Refresh recovery, successful Restart → Terminal → Stop. Old PIDs 63461/63462 and port 59596 exited before replacement PIDs 65108/65129 and port 59856 started. All four PIDs/listeners, the temporary command, two terminals, browser tab, and isolated preview server were cleaned up. Search/live mode and the original terminal were restored. The report records performance, memory, and native-vs-adapter coverage limits.

## Joint logic and memory review — 2026-09-25

The [preceding review](review-2026-09-25.md) fixed six reproducible history, URL, and persistence races with 20 new regression cases. **124 tests passed**, including native process integration, build, and distribution checks. The production preview passed simultaneous URL form saves, same-port/different-address histories, actual-cadence alerts, unchanged-DOM/hidden-work assertions, and pending-launch protection. No new UI retention or WebKit peak reduction was established.

Native Muxy loaded `index-z7cT3XVH.js` from this checkout's enabled `dist/` installation. Test command `Review 0925 0008` completed Start → Terminal → Open → Stop using PIDs 48831/48832 and port 57468. After Forget, cancelling another startup left the saved command blocked for review with no extra terminal. The command and test tabs were removed, the original terminal restored, and those PIDs/listener independently verified gone. The report records hashes, performance numbers, adapter-vs-native coverage, and the separate cleanup exception: diagnostic helper PID 47153 remained in OS state UE after TERM/KILL; its temporary executable copies were removed.

## Automated checks

`npm run check`: **141 tests passed** at the final release checkpoint above; the preceding shutdown repair passed 140, follow-up review passed 139, joint review passed 124, and association-consistency checkpoint below passed 104. None were skipped on macOS; production build and distribution assertions passed. Source/test whitespace checks passed. The earlier 82-test performance checkpoint retains its separate [source hashes and logs](performance-reaudit/lifecycle.md).

- Native integration starts disposable multiport servers and tagged worker trees. Actual shell commands reject incorrect boot/start/executable/port identities and incomplete descendant membership. A verified tree stops, a guarded replacement starts with fresh identities, and another launch is refused while its port is occupied. Cleanup targets only test-owned processes.
- A real shell test verifies the launch wrapper preserves stdin for interactive commands.
- Service/controller tests cover coalesced checks, stale/denied/incomplete data, context changes, outside-project cancellation, duplicate actions, remaining children, replacement listeners, changed launch records, stop-before-restart ordering, and uncertain responses without automatic retry.
- Grouping tests verify sibling listeners/workers aggregate once and unrelated processes are excluded. Matching directories do not establish launch ownership. Resource tests cover CPU above 100%, RSS conversion, unknown values, elapsed time, and changing readings under an unchanged identity.
- Scheduling tests use an injected clock to exercise the production foreground loop: no overlap, hidden/dialog/action holds, cancellation, focus loss during an automatic request, and disposal.
- History tests cover sustained CPU, substantial monotonic memory growth, gaps, missing data, short spikes, repeated listener replacements, intentional-action resets, and manual refresh bursts.
- Browser-host choices, custom addresses, bounded parsing/storage, script discovery, terminal links, and persistence failures retain existing coverage.

Distribution at the association-consistency checkpoint: 12 files; **78.7 KiB HTML/JavaScript/CSS**. No runtime npm dependencies, background extension script, test harness, source maps, or Python files are included. Screenshots are copied as listing assets.

CI defines Node 20.19/22/24 checks plus a macOS integration job. Publication requires successful checks for the final PR head and merged commit; their run records are available in [GitHub Actions](https://github.com/DarinRowe/run-deck/actions/workflows/ci.yml). Marketplace validation completed for the earlier launchpad does not validate this dashboard. GitHub ZIP packaging follows `RELEASE.md`; a future marketplace submission requires its separate validation and approval.

## Follow-up correctness review

Three groups of failures were reproduced and fixed through the existing module interfaces:

- A launch tree with more than 256 displayed members lost listeners outside the traversal cap. With another service present, sorting threw an undefined-port error and failed the entire refresh. Listener assignment now precedes the capped display traversal. All known ports/identities remain available, truncated aggregate CPU/RSS is unknown, and partial trees cannot be stopped. Tests cover both process orders and an unrelated actionable service.
- Disposal or workspace invalidation during an asynchronous context read could leave an old response looking valid. Launch and restart could still dispatch a terminal, and Stop could dispatch before rejecting the changed workspace afterward. Checks now revalidate disposal and a context/inspection version before continuing. Ordinary writes within the same workspace do not cancel launch, and requests already dispatched still retain their returned terminal association.
- Restart correctly rejected an edited command but its rollback overwrote the edit. Rollback now restores only the state of its own still-current launch token and preserves the latest command, name, and directory. A newer token is left untouched.

The integrated suite also verifies terminal navigation after a delayed tab lookup, preservation of confirmed terminal links when a later refresh fails, and exclusion of simultaneous stops while waiting for a shared scan. Regression tests are in `tests/action-races.test.mjs`, `tests/tree.test.mjs`, and `tests/services.test.mjs`.

The production fixture (`index-D8O89iMz.js`) passed `checkWideTree()`: two services stayed visible, ports 3000/3001 were retained, details stayed capped at 256 rows, the incomplete tree offered no Stop, and the unrelated listener remained actionable. Hidden events still caused zero reads/scans/mutations followed by one recovery scan; duplicate submission during a pending launch produced one terminal and blocked dismissal. `benchmarkUI()` also retained zero element creation on search/unchanged refresh, zero unchanged-card mutations, stable detail rows, and unsaved URL preservation at 200 services / 6,000 processes.

Two alternating Node before/after runs measured large-fixture processing medians of 10.63/11.79 ms before and 11.01/10.62 ms after, with retained heap near 8.8 MB in both versions. These runs do not establish a speedup or a WebKit memory improvement. The existing memory regression and native macOS process integrations passed in the full suite. Reproduce with `npm run check`, `npm run benchmark`, and the browser assertions exported by `tests/performance.mjs` and `tests/starter-lifecycle.mjs`.

## Association consistency and native verification — 2026-09-24

Six deterministic regression cases failed before the fixes and passed afterward:

- Forgetting a terminal association now rereads storage after confirmation. It preserves metadata edited during the dialog, refuses a replacement association, and cannot recreate a removed command.
- Successful restart now starts from the freshly revalidated record, retaining concurrent name, port, and kind edits.
- Terminal navigation checks the persisted association and the service row's observed token, so neither a stale command cache nor an old service row can navigate to a different launch.

The full 104-test suite includes the native macOS process integrations. The verified build on `codex/service-dashboard` used `dist/assets/index-Bjs4yfRu.js` (SHA-256 `3469549dd1c6d5552f209bec6a09269b12fd8ceb710a3278d5731ed149c0cb1d`) and `index-BrTUVwqA.css` (SHA-256 `2ffcf0e5353353412bd9f79b330b7a2380cdfbc27cd2427d742579b217608eb2`). Source and tests were included in the concurrent shared-workspace commit `90faf1f`; the build hash remained unchanged throughout native verification.

In the real Muxy app, extension details confirmed this checkout's `dist/` and enabled DEV state. Extensions → Reload loaded the build, and the panel reopened at `muxy-ext://run-deck/panel/index.html`. The temporary command `Review association 2256` ran `node scripts/muxy-smoke-server.mjs`:

1. Start produced wrapper/server PIDs 35098/35099 on loopback port 53132. The named service had a Run Deck association; Terminal returned from a pre-existing tab to that exact terminal.
2. Cancelling the first restart permission request kept both old processes and the HTTP response alive. The panel disabled stale actions; manual Refresh recovered the service and its association.
3. Retrying Restart with one-time Allow stopped both old PIDs. Independent `ps`/`lsof` checks confirmed their exit and the free old port before authorizing replacement startup. The replacement appeared with wrapper/server PIDs 36362/36383 on port 53356, preserving the saved name. From the old terminal, the refreshed row's Terminal action selected the replacement terminal. Open displayed the diagnostic response and PID 36383 in Muxy's browser.
4. Cancelling Forget retained the association. After Stop removed the replacement service, confirming Forget changed the saved row from linked to ready without starting another instance.
5. Removed the temporary saved command, closed only the two test terminals and test browser, and restored the original terminal. All four test PIDs were absent and both test ports had no listeners. Existing commands, unrelated services, language, sort order, live-mode preference, and remembered permission rules were preserved.

Concurrent metadata/replacement/deletion cases are covered by the deterministic adapter tests, not by native multi-window fault injection. Muxy storage still has no atomic compare-and-set operation.

## Native development-workflow verification — 2026-09-24

The [agent development workflow](MUXY-DEVELOPMENT.md) was exercised in the installed Muxy app on the shared `codex/service-dashboard` checkout. This is a separate checkpoint from the earlier performance evidence and does not certify later concurrent edits.

- `npm run check` passed **89 tests**, the build, and distribution checks. The tested build used `dist/assets/index-Nyre5ecl.js` (SHA-256 `40dfd996883d4dce4895cda9cd9178680a7147b167422ad328e0f593998ef0c5`) and `index-BrTUVwqA.css`; HTML SHA-256 was `4f478b5a6835f6c0be8ee61773d0f6be5c5ab69935c20b0ca67038b8f38598dc`.
- Confirmed the installed DEV extension points to this checkout's **`dist/`**, reloaded through Extensions, reopened the panel, and observed the new project command rows at `muxy-ext://run-deck/panel/index.html`.
- Started `node scripts/muxy-smoke-server.mjs` through the native Custom command form with a unique temporary name. One-time Allow opened a real terminal. It printed PID 26714 and loopback port 51810; `curl` returned the helper's diagnostic text and the same PID.
- Returned focus to the panel and refreshed. Run Deck showed the named service with a two-process association: wrapper 26713 and server 26714. An accessibility click alone had left focus in the terminal; a screenshot-targeted pointer click restored panel focus and updated the view.
- Selected a pre-existing terminal, then used the test row's Terminal action; Muxy returned to the exact test terminal. Open displayed the helper response in Muxy's own browser at the recorded URL.
- Stop requested only the two verified test PIDs and port. After one-time Allow, the row disappeared; independent `ps` and `lsof` checks returned no matching process or listener. The test terminal printed its shutdown message.
- Closed the test browser and terminal, removed only the newly created saved command, and restored the original terminal. The pre-existing `dev` association, other services, language, and remembered grants were preserved. Escape closed the command dialog and returned focus to Start command.

This run verified the already-installed/reload branch and native launch/terminal/browser/stop/cleanup. First-install replacement prompts, native failure injection, and restart were not repeated in this checkpoint. Its primary purpose was to validate the reusable developer workflow and the newly added smoke helper.

## Earlier native Muxy verification

Performed in the running Muxy app using the production build. Execution requests were allowed once; persistent execution grants were not changed.

1. Reloaded the dashboard and observed real listeners, resource values, host labels, and collapsed app/system processes.
2. Allowed the initial read-only check, then cancelled the next automatic consent prompt. Live mode paused, stale actions were disabled, and no further periodic prompts appeared during subsequent work.
3. Started a disposable HTTP service with a worker on port 49194 using **Start command**, a custom name, and a relative project directory. The follow-up scan showed one Run Deck service with three members: its shell, server, and worker.
4. Switched to another terminal, then clicked the service's **Terminal** action. Muxy selected the exact original terminal and its test output. Details showed the recorded command, three process identities, and individual/combined resource values.
5. Clicked **Restart**. Before authorizing replacement startup, independent process/port checks confirmed all three original members had exited and port 49194 was free. After startup consent, one replacement appeared with three fresh identities and a reliable Run Deck association. The original terminal output remained available.
6. Stopped that replacement through the panel. Its row disappeared; independent checks confirmed all six original/replacement PIDs and the test listener were gone.
7. Closed both disposable terminals, removed only the test command record, and removed the temporary project directory/script. Existing terminals, saved commands, language preference, and unrelated services were preserved.

Earlier native dashboard checks also verified **Open** in Muxy's browser with the initial execution-host confirmation and successful current-project Stop. Native testing exposed redundant focus-triggered consent and shell membership edge cases; those were corrected and covered in the regression suite. The final stdin fix was separately verified by the real-shell test.

## Browser UI verification

The isolated harness renders the production UI against a fake Muxy adapter; it never runs shell commands.

- Terminal navigation targeted the recorded tab. Restart issued one replacement launch after removing all old fixture members.
- Simulated successive observations showed **Sustained CPU** and **Memory growing** on the affected row. **Needs attention** displayed only that service. A later observation gap reset the hints.
- The hidden-panel check count remained unchanged across more than one timer period; returning to the panel resumed checking. An open command dialog similarly produced zero periodic checks. Escape closed it and restored keyboard focus to Start command.
- Denied inspection retained stale values, disabled visible service actions, and paused live checks. Manual retry recovered. A successful empty snapshot displayed the distinct no-services state.
- Numeric CPU/RSS sorting, search, project priority, browser-host reuse, remembered custom HTTPS URLs, outside-project cancellation, and default script preparation were checked. Read-only interactions did not start commands.
- English and Chinese, light/dark themes, and a 420 px desktop side panel were checked without horizontal overflow. No unhandled JavaScript errors were observed.
- Removed the redundant host/project line from the main view; host information remains in the initial browser-mapping confirmation. The build and browser checks passed after this presentation-only change.
- A [focused UX audit](ux-audit/README.md) removed repeated overview/row copy, collapsed measurement help and custom URL editing, added process-table headers, and moved shell details into advanced options. Routine pause, URL saving, project-filter labels, and English/Chinese layouts were rechecked.
- The final 1600 × 1000 light/dark listing screenshots were visually inspected. They contain synthetic names, paths, PIDs, and ports and are not native execution evidence.

## Performance evidence and limits

The performance pass is recorded in [PERFORMANCE.md](PERFORMANCE.md), including before/after DOM costs, hidden-event checks against the minified build, reproducible browser assertions, and synthetic GC measurements. The 68-test suite includes event filtering/coalescing, deferred hidden reads, cancellation midway through automatic preflight, context invalidation during a scan, manual refresh during periodic inspection, and retained heap across distinct scan histories. The minified browser fixture also verifies zero mutations in unchanged service cards and measures search with forced layout. Native process integration tests were rerun; the earlier native Muxy UI walkthrough above was not repeated for this performance pass.

The [repeat audit](performance-reaudit/README.md) fixed history identity strings retaining older scan buffers in Node/V8: three paired runs reduced retained growth from 136.6 MiB to about 0.31 MiB without changing the history interface. Four isolated native WebKit data probes did not reproduce the same retention and do not establish a fix for the earlier UI memory peak. Production browser regressions and hidden/preflight recovery checks passed after rebuilding.

A subsequent [dialog-lifecycle audit](performance-reaudit/lifecycle.md) passed a 75-test checkpoint and fixed continued reads/detached rendering after dialog dismissal, failed reopening behind an old discovery, and delayed live-check recovery. The immutable production bundle passed Chromium and native WebKit lifecycle checks, launch protection, and 20 extra native close/reopen cycles. Its source hashes distinguish those measurements from concurrent changes to the command-start flow. It does not establish a footprint/RSS reduction.

Only one scan can be in flight. A five-second timer schedules foreground scans after completion and pauses when hidden or occupied with an action/dialog. Inspection uses one host request with batched native queries, and parsing/history/persistence are bounded. Each tracked launch retains one foreground shell; there is no daemon or terminal-output buffer. Bundle size and these structural properties are not CPU or memory benchmarks.

A [35-minute native WKWebView soak](webkit-memory/README.md) subsequently completed 1,384 refresh/detail/search cycles with 200 services and 6,000 synthetic processes. All five phases completed in the same WebContent process, with zero browser errors and zero scans/DOM mutations during five minutes of simulated hiding. Footprint peaked at 1,050 MiB and fell twice without explicit GC; the final idle median was 261 MiB footprint versus 829 MiB RSS. Raw samples, source hashes, process attribution, and a graph are retained. This includes fixture allocation, not just production code, and does not measure incremental Muxy extension overhead or prove multi-day leak freedom. All test-owned native processes exited afterward.

Native Linux/SSH inspection is unsupported. Actual workspace switching during native stop consent, sustained stress through the real Muxy bridge, and concurrent multi-window launches were not manually tested; context-change behavior has fake-host coverage. Muxy storage provides no cross-window launch transaction. Live mode cannot inspect remembered-grant state; the UI explains the host's Allow & remember choice and pauses after interrupted automatic consent.

TCP listening does not prove health. RSS totals may double-count shared pages. Stop verification and TERM are not atomic; detached/reparented workers or a supervisor's later replacement may escape a snapshot. Restart is a user action for recorded launches, not automatic crash recovery. No force kill is provided.
