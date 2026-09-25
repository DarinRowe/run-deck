# Validation — Run Deck 0.1.0

Validated on 2026-09-24 (America/Los_Angeles), macOS, Muxy 1.6.0, Node 22.22.2, npm 10.9.7.

## Automated checks

- `npm run check`: 21 tests passed; production build and distribution assertions passed.
- Coverage includes duplicate launch clicks, uncertain launch responses, failed storage writes, workspace changes during confirmation/editing, closed/detached terminals, corrupted records, bounded port parsing, and script discovery without execution.
- Distribution: 8 files; 51.0 KiB total HTML/JavaScript/CSS. No runtime npm dependencies, background script, test harness, source maps, or Python files.
- Official `muxy-app/extensions` tooling at `eb37a0e526fada5b73a092c96f3a76a900f53a99`: build, manifest/resource/listing validation and package dry-run passed. One expected review warning for `commands:exec`; its only use is the manual, read-only `lsof` request.
- The unsigned installable ZIP includes the built panel, manifest, MIT license, icon, and two listing screenshots. GitHub release assets include `SHA256SUMS` for download verification.
- GitHub publication preparation updated the locked esbuild dependency from 0.27.7 to 0.28.2, resolving GHSA-g7r4-m6w7-qqqr. `npm audit` then reported zero vulnerabilities. esbuild and Vite are not shipped in the extension. The local preview binds to 127.0.0.1.

## Native Muxy verification

Performed using the running Muxy app, with execution consent allowed once rather than remembered:

- Loaded the unpacked project, enabled it, and opened its topbar panel. Native testing exposed the required `panels:write` permission; it was added and is now enforced by the distribution check.
- Added a harmless `printf`/`sleep` command and verified terminal output and the exact saved association.
- Interrupted a `sleep 300` terminal using the plugin's confirmation and Muxy's keystroke consent. The terminal displayed Ctrl+C; a process inspection confirmed the test sleep was gone.
- Closed and reopened the panel: saved commands and existing terminal associations were restored.
- Closed the test terminal: the UI showed “Terminal unavailable,” without claiming the process had stopped.
- Cancelled launch consent: the UI required review, did not retry, and created no additional terminal. Explicit forget restored the ability to launch.
- Allowed a port inspection and obtained listeners. Cancelled a subsequent scan: the error remained distinct from an empty result and the previous snapshot retained its timestamp.
- Added the source project to Muxy. Imported its actual `test` package script, verified `npm run 'test'` and task type, and saved without executing automatically.
- Launched that imported task in its project directory. The Muxy terminal reported 21 passed, 0 failed. Clicking Terminal returned to this exact output after selecting another terminal.
- Removed the disposable Home test records and closed their terminals. The useful `test` command and completed test output remain in the Run Deck project.

## UI verification

The isolated browser harness uses the production UI with a fake Muxy interface. Verified add/save, filtering/search, a single launch call, script-import review, Escape cancellation, English/Chinese switching, and manual port inspection. No unhandled JavaScript errors were observed. At 380 px viewport width the document also measured 380 px: no horizontal page overflow. Dark and light 1600 × 1000 listing screenshots were visually inspected and use synthetic project names, paths, PIDs, and ports.

## Performance evidence and remaining limits

The implementation has no periodic timer or background script, starts no helper process, makes no automatic port requests, and keeps no terminal output buffer. Lists and input sizes have explicit bounds. These properties reduce work and memory retained by the plugin; bundle size is not a measurement of runtime memory.

No reliable incremental WebKit memory or sustained CPU benchmark was collected. Muxy's resource popover aggregates app/extension-host usage and cannot attribute the panel's WebKit memory to Run Deck. Long-running stress tests, multi-window races, native worktree-switch-during-dialog and native Send to Background flows remain unmeasured; related controller behavior is covered by fake-host tests. Cross-window transactional launch exclusion is not provided by Muxy storage and is not promised.

This release is a command launchpad, not a process supervisor. It does not provide exit codes, health checks, automatic restart, or reliable force-stop. Remote non-macOS port inspection is unsupported. Store publication still requires upstream maintainer review and merge.
