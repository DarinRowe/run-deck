# Performance re-audit: retained scan text

Measured on 2026-09-24 (America/Los_Angeles), Node 22.22.2, Apple M1 Pro / 16 GiB, macOS 15.4.1, system WebKit 20621.1.15.11.10.

The repeat audit found and fixed one reproducible memory-retention problem in `ServiceHistory`.

## Finding and change

Each new listener history stored `service.listeningIds` directly. In V8, that short identity could retain slices/concatenations backed by the complete scan text. A 200-record limit therefore did not bound the backing strings to 200 small values. This was missed by the earlier benchmark, which repeatedly parsed the same input string instead of retaining histories from distinct snapshots. V8's [string implementation](https://chromium.googlesource.com/v8/v8.git/+/ed225df70cc62b03942850ddd5493c365aff3157/src/objects/string.h) describes sliced strings holding their parent.

The isolated reproduction generated 200 distinct host snapshots, each containing 6,000 processes and one newly observed listener. After full GC, retaining history added **136.6 MiB**. Removing samples alone did not reduce it; serializing only the stored identities reduced the retained scan data. Clearing history also released the older buffers.

`observe()` now serializes the listener identity before retaining/comparing it. This preserves exact replacement detection while keeping the string-lifetime concern inside the history module. Its interface, record/sample caps, alert thresholds, scheduler, and stop/restart guards are unchanged.

The new regression test runs the real parser → grouping → history path in a fresh Node process with explicit GC. It failed before the fix with `History retained 136.6 MiB` and passes afterward. Its 16 MiB growth budget is intentionally generous; it is a memory-regression guard, not a timing threshold. The history remains live across the measurement through a subsequent call to `observe()`.

## Node measurements

Three alternating before/after pairs used frozen source copies. The only production source difference was the history identity change. Entries below are medians across the three runs; retained memory is growth over the pre-history baseline, not total application memory.

| Workload | Before | After |
| --- | ---: | ---: |
| 200 distinct-snapshot histories, retained heap growth | 136.605 MiB | 0.314 MiB |
| 20 services / 200 processes, parse + group + history median | 0.40 ms | 0.44 ms |
| Same small workload, p95 | 0.76 ms | 0.84 ms |
| 200 services / 6,000 processes, median | 9.68 ms | 9.55 ms |
| Same large workload, p95 | 14.27 ms | 14.46 ms |

The retained heap reduction exceeds 99%. CPU differences are small in absolute terms and do not establish a speedup. [Raw Node results](node-comparison.json).

## Native WebKit cross-check

Four fresh native WKWebView processes ran before/after/before/after. Each parsed 1,200 distinct 6,000-process snapshots, held 200 histories in a rolling window, paused 30 ms per ten snapshots, then idled for twenty seconds. This is a **pure data probe** on a blank page, not the full UI or Muxy bridge. No explicit GC was requested. Kernel physical footprint and RSS were sampled once per second; idle values below are medians of the final ten live samples.

| Run | Active duration including pauses | Peak footprint | Idle footprint | Idle RSS |
| --- | ---: | ---: | ---: | ---: |
| Before 1 | 13.748 s | 131.1 MiB | 30.6 MiB | 202.8 MiB |
| After 1 | 13.818 s | 137.1 MiB | 29.6 MiB | 197.5 MiB |
| Before 2 | 13.835 s | 143.3 MiB | 32.0 MiB | 211.7 MiB |
| After 2 | 14.175 s | 139.8 MiB | 41.1 MiB | 223.2 MiB |

**WebKit did not reproduce the V8 retention in this probe, and these results do not demonstrate a native memory improvement.** In particular, this fix does not explain or establish a reduction in the previous full-UI 1.03 GiB peak. Natural collection timing and the different workload prevent equating these numbers with the [35-minute UI soak](../webkit-memory/README.md). All four probes completed without errors or hidden documents, and all sixteen test-owned host/helper processes exited.

Evidence: [native summary](native-summary.json), [workload/visibility log](native-workload.ndjson), [raw kernel samples](native-memory.ndjson.gz), [exit verification](process-exits.json), and [source/build hashes](manifest.json). The [retained patch](change.patch) identifies the exact production change.

## Other review and verification

The audit also reviewed foreground scheduling, host-event coalescing, parser and tree limits, retained service snapshots, card/detail lifetime, saved-command reads, and resource formatting. Existing caps and lazy/reused DOM remain appropriate; this pass did not reproduce another high-leverage production issue that justified a new abstraction or cache.

- `npm run check`: **68 tests passed**, including the new memory regression and real macOS process integrations; build/distribution checks passed. The package contains nine files and 69.4 KiB HTML/JS/CSS, with no runtime dependency or benchmark fixture shipped.
- Production UI assertions passed for 200 services / 6,000 processes: zero element creation on search/unchanged refresh, zero mutations in unchanged cards, process-row identity reuse, edited URL preservation, and detail removal on close.
- In the paired warmed browser run, search including layout measured 9.8 ms median / 12.2 ms p95 before and 9.5 / 11.1 ms after. The benchmark uses 25 search iterations and explicit detail checks. Those timings are observations, not regression thresholds. [Raw UI results](ui-comparison.json).
- Hidden event checks produced zero reads/scans/DOM mutations and one recovery scan. Hiding during asynchronous preflight produced zero subsequent reads/scans; explicit refresh recovered with one scan. Checks used fresh fixtures with the fake host placed in foreground.
- Earlier combined browser calls exceeded the tool's evaluation deadline; their pending work was discarded by reloading, and checks were rerun separately. Only completed assertions are counted.

## Reproduce

```sh
node --expose-gc scripts/benchmark-history-memory.mjs
node --test tests/history-memory.test.mjs
npm run benchmark
npm run check
```

The native [diagnostic probe](native-data-probe.mjs) is archived as measurement evidence. In a **temporary repository copy**, place it at `tests/webkit-soak.mjs`, serve a blank HTML page from the repository root, and point the existing compiled `scripts/webkit-memory.swift` host at that page with a duration argument of 120. It finishes its fixed 1,200 iterations plus twenty-second idle period. Use `scripts/sample-webkit-memory.py` with the host-owned WebKit PIDs, as described in the full soak report. Use the retained patch/source hashes to select before and after versions in separate copies. Do not overwrite the normal soak fixture in the working repository.
