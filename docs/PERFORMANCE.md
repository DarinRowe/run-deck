# Performance validation

Measured on 2026-09-24, macOS, Node 22.22.2, using the local Chromium fixture preview. Native scanning was measured separately during the audit. These numbers describe this machine and synthetic workloads; they are not a sustained Muxy WebKit RSS measurement. A subsequent [35-minute native WKWebView soak](webkit-memory/README.md) records physical footprint and RSS separately against an immutable production build.

## Changes and measured effect

| Workload | Before | After |
| --- | --- | --- |
| Search JavaScript, 200 services / 6,000 processes, all details closed | 78–121 ms per input | Production median 0.9 ms, p95 1.2 ms |
| Elements created per search in that workload | 32,000 | 0 |
| Attached elements in that workload | 40,676 | 4,476 |
| Elements created by an unchanged refresh | Detail tree and metadata recreated repeatedly | 0 |
| DOM mutations in unchanged service cards, 200 services | 3,000 after the first optimization pass | 0 |
| 10 unrelated tab updates with 100 saved commands | 1,000 storage reads, 10 renders | 0 storage reads or tab-list requests |
| Hidden burst of tab and workspace events | Continued event reads/rendering | 0 reads, scans, or DOM mutations |
| Foreground recovery after that burst, three saved commands | Uncoordinated invalidations | 3 command reads, 1 tab list, 1 scan |
| Production HTML/JS/CSS | About 95 KiB | 69.3 KiB |

Search JavaScript timings exclude layout and paint. The follow-up benchmark also forces layout after every input: production median 10.3 ms, p95 11.3 ms at 200 services / 6,000 processes, and median 1.1 ms, p95 1.4 ms at 20 services / 200 processes. These still exclude asynchronous paint. Before removing redundant attribute writes, the large fixture measured 9.7 ms median and 15.0 ms p95 including layout; these small timing differences are subject to noise, not evidence of a reliable speedup. Element counts, allocation checks, and mutation counts are the reproducible regression assertions; elapsed time is not a CI pass/fail threshold.

Details allocate their body only when expanded and release it when closed. Expanded process rows use process identity as their key. Metric updates retain the same rows and metadata cells, and preserve an unsaved browser address. Search reuses cards. Rendering notifications coalesce per animation frame and do not paint hidden panels.

Launchpad filters tab events against recorded terminal associations, batches synchronous bursts, and reads only terminal availability for relevant events. An unchanged title or tab list does not notify the renderer. Workspace events invalidate state immediately; automatic work waits for foreground and idle state. Explicit refresh still reloads persisted commands, and launch/stop/restart preflight checks retain their fresh reads and process guards.

## Follow-up findings

Two additional issues were reproduced after the first pass:

- Hiding the panel during asynchronous automatic preflight still allowed one subsequent shell scan. The scheduler now cancels that inspection, and Launchpad rechecks visibility between saved-command read phases. Delaying storage-key enumeration and hiding before it completes now produces zero subsequent saved-command reads and zero scans. Returning to foreground keeps the interrupted scan paused; explicit refresh completes exactly one scan and clears the error. Unit tests also cover cancellation during context and URL-storage reads. Already dispatched host requests cannot be cancelled through the available Muxy interface; cancelled inspection results are discarded.
- An unchanged 200-service snapshot reused elements but still wrote 3,000 DOM attributes. Guarded attribute/property updates now produce zero mutations in the service list for that fixture. This avoids redundant DOM work without adding another rendering cache or changing action guards.

## Data processing and memory

`npm run benchmark` performs two batches of 100 synthetic snapshots, forcing GC after each batch:

| Fixture | Parse + group + history median / p95 | Retained JS heap after batches |
| --- | --- | --- |
| 20 services / 200 processes | 0.42 / 0.73 ms | 4.11 / 4.12 MB |
| 200 services / 6,000 processes | 9.56 / 14.12 ms | 8.796 / 8.797 MB |

The heap includes the benchmark runtime, fixture input and most recent results. It is not the extension's total memory or a browser RSS measurement. No sustained growth appeared in these batches. History remains capped at 200 keys and 16 samples per key; replacement detection now retains only its three required timestamps.

During the preceding audit, this machine's roughly 550 processes and nine listeners took about 150 ms per native scan; JavaScript parsing/grouping took about 1 ms. The native collection protocol and five-second foreground interval are unchanged. The main savings come from eliminating unnecessary event work and hidden detail allocation.

The follow-up also measured grouping a wide tree with roughly 6,000 children and the existing 256-member display cap: median 0.66 ms, p95 1.86 ms. This did not justify a new traversal abstraction. Native collection remains the largest measured cost on the audit workload.

## Repeat audit: retained scan text

A subsequent [focused re-audit](performance-reaudit/README.md) found that the original fixed-input GC benchmark missed retention across distinct scans. In Node/V8, 200 different listener histories retained about 136.6 MiB through identity strings backed by older full-host scan buffers. Serializing the identity inside `ServiceHistory` reduced retained heap growth to about 0.31 MiB in three paired runs. The new memory regression failed before the fix and passes afterward. The module's interface and replacement-detection semantics are unchanged.

CPU timings stayed close: large-fixture median 9.68 → 9.55 ms, p95 14.27 → 14.46 ms. These are not evidence of a speedup. Four native WebKit data probes did not reproduce the V8 retention or establish a memory improvement; this fix must not be presented as resolving the full-UI WebKit peak below. The [re-audit evidence](performance-reaudit/README.md) includes raw paired measurements and those limits.

## Native WebKit memory

A later [dialog-lifecycle audit](performance-reaudit/lifecycle.md) fixed unnecessary file reads and detached-dialog updates after closing Start command, a reopen failure behind an old read, and the resulting live-check hold. Chromium and native WebKit confirmed the fix, with 20 additional native close/reopen cycles. This is an I/O/lifecycle improvement; no WebKit footprint reduction is claimed.

The native WebKit soak completed 1,384 cycles of 200 services / 6,000 processes, including 11,072 detail expansions. Five minutes of simulated hidden-panel events produced zero scans and DOM mutations; no browser errors occurred. WebContent footprint peaked at 1,050 MiB and dropped twice without process replacement or explicit GC. Its final two idle minutes had a median footprint of 261 MiB and RSS of 829 MiB. This does not establish low memory use or multi-day leak freedom: fixture generation and serialization are included, RSS remains substantial, and the real Muxy bridge is not stressed by this harness. See the [full evidence, curve, and reproduction steps](webkit-memory/README.md). No additional production cleanup was applied based on these measurements.

A later [WebKit attribution investigation](webkit-memory/attribution/README.md) reproduced a 1.36 GiB peak without loading Run Deck or process data. Full-scale refresh/search without detail toggles stayed around 70–75 MiB during active work. Query substitutions and several bounded cache prototypes did not eliminate growth under repeated detail toggles and were not adopted. The evidence distinguishes the stress trigger from an established plugin leak or a verified production fix.

The [2026-09-25 joint review](review-2026-09-25.md) corrected endpoint-key collisions, sustained-observation timing, and persistence races. The final 200-service/6,000-process benchmark measured 10.15 ms median / 13.32 ms p95, with stable retained heap across GC batches; distinct-scan retention remained about 0.33 MiB. Production search and unchanged refresh still created no elements, and unchanged cards produced no DOM mutations. These correctness changes do not establish a performance speedup or a fix for the WebKit peak.

## Reproduce

The [follow-up joint review](review-followup-2026-09-25.md) fixed cancellation work escaping discovery and foreground scheduling, plus incorrect SVG visibility. Its final 200-service/6,000-process fixture still created no elements for search or unchanged refresh and made no unchanged-card mutations. Distinct-scan retention was about 0.33 MiB; no further WebKit memory improvement was established. The report contains build-scoped measurements and native verification.

Run `npm run check` for the Node suite, including native macOS integrations, discovery cancellation, and the distinct-scan memory regression, plus build and distribution assertions. Run `npm run benchmark` for synthetic data processing and GC observations, and `node --expose-gc scripts/benchmark-history-memory.mjs` for retained memory across distinct scans. These benchmarks never discover or signal real processes; the existing native integration tests use disposable test-owned processes.

For browser regression checks:

1. Run `npm run build` and `npm run dev`.
2. Open `/tests/preview.html?build=1` to run the minified production bundle against the fake Muxy adapter.
3. In that page, execute:

```js
const checks = await import('/tests/performance.mjs');
await checks.checkHiddenEvents();
await checks.checkHiddenPreflight();
await checks.benchmarkUI(20, 10);
await checks.benchmarkUI(200, 30);
```

The browser checks assert no collapsed process rows, no element allocation during search/unchanged refresh, no service-list mutations for an unchanged snapshot, row identity reuse on resource updates, preservation of an edited URL, detail release on close, hidden event suppression, one foreground recovery, and cancellation when hidden midway through preflight. The harness and benchmark files are excluded from distribution. The plain `/tests/preview.html` route tests source modules.

The minified fixture build was also checked for a denied automatic scan: it paused after one rejection, disabled stale actions, and did not retry while idle. Manual refresh recovered. Terminal navigation reached the recorded tab; Restart removed all three old fixture members before opening exactly one replacement. Expanded details were visually inspected at a 420 px panel width. No unhandled browser errors were observed.
