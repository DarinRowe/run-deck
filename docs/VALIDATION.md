# Validation — Service dashboard

Validated on 2026-09-24 and 2026-09-25 (America/Los_Angeles), macOS, Muxy 1.6.0, Node 22.22.2, npm 10.9.7. Dated checkpoints identify the source/build they cover. The published v0.1.0 package is the earlier command launchpad.








## Marketplace tooling preflight — 2026-09-25

Checked official `muxy-app/extensions` at `eb37a0e526fada5b73a092c96f3a76a900f53a99` in an isolated sparse checkout, copying the current working source without git metadata, node_modules, dist or logs. Official `scripts/build.mjs run-deck`, `scripts/validate.mjs run-deck`, and `scripts/pack.mjs --dry-run run-deck` all passed. Dry-run package: 220594 bytes, SHA-256 `3897d2e4a1b817d932555aa9dbbc605b69aa0b05e453eea9315e1760edfb42ad`. Advisory review flags: commands:exec permission and fixture fetch usage in tests/preview.mjs. These are not validation failures or approval.

The existing `public/assets/icon.svg` is configured as the marketplace listing icon and accepted by validation. Listing screenshots pass format validation but should be refreshed to show the latest UI before submission. Current project CI only checks builds/tests; there is no release-to-marketplace PR automation. Official publication requires a PR to the extensions repository, maintainer approval/merge, then its signing/upload workflow. A GitHub Release in this repository alone does not list the extension. No remote fork, PR, release or store submission was created by this preflight.

## Single-line memory overview — 2026-09-25

CSS-only: redistribute overview columns to .65/1.05/1.3 for service count, CPU and memory; keep values on one line. Narrow values use 18 px type with the existing smaller units. Remove the two-line value reservation, reserve two label lines instead, and constrain the inner grid track so long CPU readings cannot change label wrapping. Uses existing theme/sizing conventions; no host or interaction changes.

`npm run check` passed 141 tests and distribution/build checks (84.1 KiB). JS `index-C6ojCR67.js`, SHA-256 `26ab3f5fb371ddbfe978dc3f72d828ced01e60d3ed973aee7fc53ec29442ca5a`; CSS `index-CBUL1RaQ.css`, SHA-256 `c2dd94dfadf25daada358360a9e15a01e798e82c5a12fcf6bd1381740eed9aa2`.

Inspected Chinese light at 300 px during development. Final production English dark card-stability fixture passed at 300 px including missing readings and >1000% CPU. An intermediate version exposed label reflow; the fixed inner track and label reservation removed it. Native Muxy 1.6.0 reloaded the same enabled checkout build and visibly showed `≈ 442 MB` on one line with aligned summary numbers. No native service or preference changed. Preview tab closed, viewport reset, Vite stopped; port 5197 clear.

## Icon-only Refresh — 2026-09-25

Refresh now uses the existing icon in a 28 px button, with localized title/accessible name and aria-busy during checking. Reduced section-action spacing to 4 px. This preserves the existing refresh handler and prevents the reported header wrapping at the tested narrow width. No host or lifecycle change; official appearance tokens/sizing continue to apply.

`npm run check` passed 141 tests and build/distribution checks (83.9 KiB). JS `index-DGMSux19.js`, SHA-256 `26ab3f5fb371ddbfe978dc3f72d828ced01e60d3ed973aee7fc53ec29442ca5a`; CSS `index-Dnw0El8w.css`, SHA-256 `c8e8c026420bce54e4308678848ffd44f1b0dab819cde0b8ff11f9186a74b138`.

Final production fixture passed card stability at 314 px. Inspected English and Chinese dark layouts: heading, live toggle and refresh icon stay on one row. Enter activates the accessible Refresh button; after completion aria-busy is false, and switching language gives the accessible name 刷新. Native Muxy 1.6.0 reloaded the enabled DEV build from this same checkout and visually showed the header on one row in its light narrow panel. Native click attempts produced no distinct observable AX change, so refresh action evidence is the production browser fixture; native evidence establishes presentation only.

Cleanup: preview tab closed, viewport reset, Vite stopped, port 5197 clear. No native service/tab/command or preference changed.

## Smaller overview memory unit — 2026-09-25

Memory overview now renders its number and unit in persistent separate elements. MB/GB use 60% of the numeric font size, medium weight and the muted theme token; unavailable values hide the unit. No process, host, lifecycle or interaction changes. Existing reserved overview height remains.

`npm run check` passed 141 tests and build/distribution checks (83.8 KiB). JS `index-DLjAbMMz.js`, SHA-256 `57772cf1c23c9a3ca1cd2142b6df16bc11a83bc04cfd5d3e4fbf5a5f8b418b58`; CSS `index-B9pnpkTM.css`, SHA-256 `7ce512b53354984865eb5dce42666edb52138d6205862a636d81d065031bd291`. Final production card-stability fixture passed in light English at 320 px, including missing readings and unit changes. Visually inspected smaller GB in the fixture and smaller MB after reloading the same enabled DEV build in Muxy 1.6.0. Native accessibility still exposes the complete memory reading. The very narrow native panel can wrap MB onto a second line, now in smaller type as requested.

Closed the preview tab, reset viewport and stopped Vite; port 5197 is clear. No native service, saved command, tab, permission or preference was changed. Appearance uses the previously consulted official theme/sizing guidance.

## CPU trend grouping — 2026-09-25

CSS-only refinement on the same working tree and Muxy 1.6.0: CPU and its trend occupy the left column; the memory column spans both rows with a full-height separator. The trend is 96 px wide, constrained to its column. Reserved warm-up space and stable metric layout remain. Theme tokens and spacing follow the previously consulted official appearance guide; no API, lifecycle, copy or action changes.

`npm run check` passed 141 tests, build and distribution checks (83.4 KiB). JS `index-DcLJ-YmH.js`, SHA-256 `c229f9c0f7aa54666876f75f0a8d04664db2f9fed332cd4da85d4886b3116905`; CSS `index-De-cF52v.css`, SHA-256 `813bc186f38260f87de3148dfeaadf9ab76ed6aa4d36ffaa445437b5aaf084d2`.

Final production card-stability fixture passed light Chinese at 320 px and dark English at 360 px. Inspected [dark synthetic preview](service-card-ux/cpu-group.png). Reloaded the enabled native DEV extension from the same confirmed checkout path, reopened its panel and visually confirmed the full-height separator in the user's narrow light panel. Interaction handlers and focus behavior are unchanged. No services or preferences were changed for this CSS pass. Temporary browser viewport/tab and Vite server were cleaned up; port 5197 was clear.

## Stable metric layout — 2026-09-25

Working tree based on `a3d8b106a1e1aa64fd97175adb2f5d680df90d80`, Muxy **1.6.0**. `npm run check`: **141 tests passed**, zero failures/skips; production and distribution checks passed (83.4 KiB). JS `index-4fubl1A-.js`, SHA-256 `c229f9c0f7aa54666876f75f0a8d04664db2f9fed332cd4da85d4886b3116905`; CSS `index-CcTSTVb8.css`, SHA-256 `b9a70824865c8757881647dba9739749499d8e11da17c700635e0f6471954f88`.

Reproduced using `tests/preview.html?cardStability=1` at 360 × 760. The real renderer and fake host produced card heights **168.09 → 195.09 → 172.05 px**, with the action row moving **27 px** and the memory column moving horizontally. Metric ranking changed label width and weight; the newly visible trend participated in flex wrapping. A second reproduction at 320 px exposed **23.5 px** list movement when a missing overview reading removed a wrapped line.

Fix: stable CPU/Memory labels and weight, equal metric columns, a reserved trend row hidden with visibility while history warms up/resets, and two-line space for narrow overview values. Highest values retain accent color, explanatory tooltip and accessible labels. No host API, permissions, lifecycle, inspection, sorting or process-action changes. Theme/sizing follow the official muxy-extension appearance contract linked in MUXY-DEVELOPMENT.md.

Regression: `tests/card-stability.mjs`, enabled by the preview query, changes CPU (including >100%), memory units, ranking, missing readings and a history-reset gap through actual Refresh. It measures card, actions and memory geometry across seven observations. The original version failed; the final production build passed dark English and light Chinese at both 320 and 360 px, with unchanged measured x/y/width/height. Browser warning/error logs were empty. These are browser-renderer fixtures, separate from the 141 Node/native tests.

Native: reloaded the enabled DEV extension from this checkout's previously confirmed `dist/` path and reopened `muxy-ext://run-deck/panel/index.html`. In Muxy's light narrow panel, inspected the reserved empty trend area after loading and the populated trend after subsequent live checks: the trend stayed in its own row and action divider stayed in place. Native CPU/memory labels and highest-value accessibility hints reflected the final build. Numeric before/after proof comes from the deterministic browser fixture; native observation is visual. User services changed independently during inspection; service removal and explicit metric-based sorting may still legitimately move whole cards.

Cleanup: closed the fixture tab, reset viewport, stopped Vite, and confirmed no listener on 5197. No service was started/stopped/restarted through Muxy, no command was saved, and no native tab or permission was created. Original project/tab, live mode, sort, language and theme remain unchanged. Temporary private native evidence is under `/tmp/run-deck-stability/`.

## Service card visual polish — 2026-09-25

Working tree based on `a3d8b106a1e1aa64fd97175adb2f5d680df90d80`, Muxy **1.6.0**. `npm run check` passed **141 tests**, zero failures/skips, production build and distribution checks (83.1 KiB). JavaScript `index-C7QO4QYU.js`, SHA-256 `0b80ff4bbd19f997bca49e58777101a81f7bd3b5a709da22e168c4b20b35cc4f`; CSS `index-DIOmoZuo.css`, SHA-256 `0daea042caa05d47c3ac3c2e9d97564120d15c387b26f077e9b1d119d9ff3a28`.

Scope: service-card presentation only. Status now aligns with the title, the project label is a subdued badge, resource readings have a separator, and a divided action row gives Open, Terminal, Restart and Stop distinct emphasis. Controls use the official muxy-extension skill's theme tokens and sizing guidance. No host API, manifest, process action, persistence, or lifecycle changes. Acceptance: readable card hierarchy and complete actions in narrow panels, with detail and keyboard behavior preserved.

Native: confirmed enabled DEV path `/Users/darinlo/Documents/Projects/run-deck/dist`, reloaded, reopened `muxy-ext://run-deck/panel/index.html`, and visually verified the new title/status and action divider on the actual PrintAnvil dev card in the user's light theme. English and Chinese labels fit. Details opened with the pointer; Return collapsed it with focus retained on the summary. Service action handlers are unchanged; this presentation pass did not restart or stop user services.

Production browser fixture: inspected dark English at 360 × 760, dark Chinese at 320 × 760, and light at 360 × 760. The 320-pixel document measured client/scroll width 320/320. Keyboard Enter toggled Details open and closed. Warning/error logs were empty. Evidence uses synthetic services: [dark](service-card-ux/dark.png), [light](service-card-ux/light.png). Dark-theme verification is browser-only; this is not a full accessibility audit.

Cleanup: closed the fixture tab, reset viewport, stopped Vite and confirmed port 5197 has no listener. No native test terminal, command, or browser was created. Restored English; original PrintAnvil terminal, theme and live mode remain selected.

## Post-launch refresh — 2026-09-25

Working tree based on `a3d8b106a1e1aa64fd97175adb2f5d680df90d80`; Muxy **1.6.0**. `npm run check` passed **141 tests**, zero failures/skips, production build and distribution assertions (82.9 KiB HTML/JS/CSS). JavaScript `index-rXwTl-Q4.js`, SHA-256 `e74db9678af1f94e9d7143c8e935d59c7811bfe37bd95b90410b5f84e85e960a`; CSS `index-DB5APwOT.css`, SHA-256 `4994cc67d7767484bf6ca3ae8f803ee70af8a5d97469e3621da753a746d1daf9`.

**Reproduction and cause.** The real Start dialog in the synthetic host launched a listening process, transferred focus to its terminal, and left live polling paused. Before the fix, `tests/preview.html?postLaunchCheck=1` reported a timeout, **zero scans after launch**, and one new listening process. The one-second invalidation was gated by `panelVisible`; the same focus gate suppressed completed-action rendering. A fast failed scan also exposed dialog-close timing that left controls visually disabled. Start/Restart now make an immediate explicit fresh inspection, with three bounded follow-ups for delayed listeners, and repaint action completion even if the terminal holds focus. This does not change automatic consent retry rules or the five-second periodic interval.

**Contracts.** Reviewed [Panels](https://muxy.app/docs/extensions/panels), [Events](https://muxy.app/docs/extensions/events), and [Lifecycle](https://muxy.app/docs/extensions/lifecycle). No new host API, permission, or manifest field. Existing explicit Refresh semantics are reused; hidden documents, disposal and changed worktree stop later attempts. No claim that an opened terminal proves a running service. Long startups beyond the bounded checks need a later regular/manual inspection.

**Regression fixture.** With `npm run dev -- --port 5197 --strictPort`, open `tests/preview.html?build=1&postLaunchCheck=MODE` and inspect `#post-launch-result`. All five modes passed on the recorded production build: `ready` (one scan, 15 ms synthetic elapsed), `delayed` (two scans, 515 ms), `denied` (one scan then stops), `switched` (one scan; no stale service), and `no-listener` (four scans then stops). Every mode also asserts one terminal launch and preservation of paused live mode. These fixture timings exclude real host/consent latency. Updated the older starter lifecycle fixture's close selector for the title-row close control.

**Native verification.** Extension details confirmed enabled DEV `/Users/darinlo/Documents/Projects/run-deck/dist`; reloaded the final build. In the run-deck worktree, verified Working directory, explicitly paused periodic polling, and saved/started `Refresh check 0925` using `node scripts/muxy-smoke-server.mjs`. Accepted only matching one-time permissions. Without clicking Refresh, the panel inspected and showed the matching Run Deck service on port **52560**, wrapper/server PIDs **48360/48361**, launch token `cc1b2352-d9e9-4466-ab29-a82a8d213c57`. The first observation after Allow showed Checking; the next showed the row. Native elapsed latency was not precisely measured. Terminal selected the exact test terminal; Open showed the diagnostic page and PID.

Restart, still with live mode off and without manual Refresh, replaced the row with port **52792**, PIDs **49361/49382**, token `91c860f9-93e6-41d1-9c9f-b172b5ba621f`. Stop removed the row. `ps` and `lsof` confirmed both generations and listeners exited. Closed the two test terminals and test browser tab, removed only `Refresh check 0925`, restored live mode and original project/tab. Closed the fixture browser and Vite server; port 5197 was clear. Existing user services and permission rules were preserved.

## Command dialog visual polish — 2026-09-25

Working tree based on `a3d8b106a1e1aa64fd97175adb2f5d680df90d80`, Muxy **1.6.0**. `npm run check` passed **141 tests**, zero failures/skips, build and distribution assertions (82.6 KiB HTML/JS/CSS). JavaScript `index-CNNsm8E_.js`, SHA-256 `8729f1d06c8b88d703ec05b73908108a4b8bbc97177e476cd2230ac478d85d6e`; CSS `index-DB5APwOT.css`, SHA-256 `4994cc67d7767484bf6ca3ae8f803ee70af8a5d97469e3621da753a746d1daf9`.

Scope: presentation in `src/main.js` and `src/style.css`; title-row close placement, lighter list separators, aligned action column, theme-aware backdrop, consistent disclosures, and a contained custom-command form. The [official guide's Theme and Sizing contract](https://github.com/muxy-app/muxy/blob/main/Muxy/Resources/skills/muxy-extension/SKILL.md) informed the change. No host calls, manifest fields, process handling, or persistence changed. Acceptance: less visual weight and clearer actions, while native disclosure, form validation, and dismissal continue to work.

1. **Choose a command — passed.** Captured the native baseline before editing: heavy list enclosure, uneven action positions, and an oversized footer close area. Verified enabled development path `/Users/darinlo/Documents/Projects/run-deck/dist`, reloaded the final build, and reopened `muxy-ext://run-deck/panel/index.html`. Final native light view showed straight inset separators and title-row Close, tying it to the final CSS revision. English and Chinese labels fit; actions keep their column and top position when a script expands.
2. **Inspect details — passed.** Native script and Working directory disclosures revealed the full body and actual worktree path. Both header Close and Escape dismissed the dialog and returned focus to Start command. The existing native disclosure semantics and accessible labels remain intact.
3. **Custom command — passed for the affected presentation.** Native Chinese form expanded correctly; empty Save & start showed WebKit's required-field message and focused the command field. The final production fixture in dark theme at 360 × 760 and 320 × 760 had no horizontal overflow, including expanded More options; measured dialog client/scroll widths were 326/326 and 286/286 respectively. Browser warning/error logs were empty. No real command was launched in this presentation-only pass; the earlier service-flow checkpoint below covers that separate build.

Evidence: [final dark production fixture, synthetic data](start-command-ux/08-polished-dark.png). Native baseline, expanded details, Chinese form and final view were captured and inspected under `/tmp/run-deck-polish/`; private terminal screenshots are excluded from repository assets. Native verification used the user's light theme; dark verification used the production browser fixture. Full screen-reader/WCAG compliance was not assessed.

Cleanup: closed the temporary browser tab, reset viewport, stopped the test Vite server, and confirmed no listener remained on port 5197. No saved command or native terminal was created. Original project, terminal selection, English language and theme are restored; Muxy is left displaying the final command dialog.

## Compact command dialog — 2026-09-25

The working tree based on `a3d8b106a1e1aa64fd97175adb2f5d680df90d80` passed `npm run check`: **141 tests**, zero failures/skips, production build, and distribution assertions (80.5 KiB HTML/JS/CSS). JavaScript: `index-B2gsQPpi.js`, SHA-256 `a073d548b144bfb10230fbc4e9372b778ec0901ba2908376f6a14b9e979f7b3f`; CSS: `index-BL6hOVlz.css`, SHA-256 `e0b5842d02fca455b57c8028360721d7fcbc430ba4ad7f4f87b17b7cb643fb44`.

The native baseline showed repeated project/path/explanatory text, a root-directory label on every row, and full script bodies pushing Custom command below the initial view. The updated dialog removes those defaults, discloses script bodies and worktree context, and preserves non-root directories and unresolved-terminal warnings. The existing theme tokens and the title/spacing scale follow the [official extension guide](https://github.com/muxy-app/muxy/blob/main/Muxy/Resources/skills/muxy-extension/SKILL.md). No host API, manifest, launch, or persistence contract changed.

1. **Choose a command — passed.** Muxy 1.6.0 extension details confirmed this checkout's enabled `dist/`; Reload then reopening Run Deck showed the compact dialog. On the existing project with three primary commands, Custom command was visible without scrolling. English and Chinese rendered correctly in the native light theme.
2. **Inspect details — passed.** Native script disclosure revealed the original script body; Working directory revealed the actual project/branch/path. Escape closed the dialog and returned focus to Start command. The production fixture at 360 × 760 retained non-root saved-command directories, supported keyboard expansion of Other scripts, and had no horizontal dialog overflow. Empty custom submission focused the required command field. Its hovered primary button retained contrasting foreground/background colors; captured browser warning/error logs were empty.
3. **Start and recover — passed.** In the run-deck worktree, custom command `node muxy-smoke-server.mjs`, name `UX compact 0925`, first rejected directory `../` with the form preserved. Correcting it to `scripts` and granting one-time startup consent launched wrapper/server PIDs 32639/32640 at `http://127.0.0.1:49347/`. Reopening the dialog showed `Directory: scripts`; Terminal returned from a pre-existing tab to the exact test terminal. Open displayed the diagnostic response/PID in Muxy's browser. Stop ended both processes and the listener, confirmed independently with `ps` and `lsof`. After closing the test terminal, the saved command retained its review warning and disabled Start until removed through its menu.

Cleanup removed the test command, terminal, browser tab, and temporary preview server. The original project, terminal selection, English language, and empty search were restored; existing services, saved commands, and consent rules were preserved. Native screenshots were captured locally during this run; the shareable [360px screenshot](start-command-ux/07-compact-dark.png) uses synthetic data. Dark theme and overflow assertions used the production browser fixture; native checks used the user's light theme. Screen-reader operation and full WCAG compliance were not assessed.

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


## 0.3.0 multilingual release verification — 2026-09-25

- Build: `index-DQWwtyXl.js` SHA-256 `fc411450bc6b2da699922b0ba9cdc999b18c3662fe7f0b87361f31ee58cf9e15`; `index-DUU9nb3u.css` SHA-256 `b0186e18359eecd0ca9d08b9c9a88230333c8e125195f281e4bc828ee28122ab`. Native loaded from this checkout's `dist/`, with the new seven-option language selector confirming the running build. No new host APIs or permissions.
- `npm run check`: 148 tests passed, including real macOS process integration, all locale keys/placeholders, and the distribution check. Code bundle 116.2 KiB against a 128 KiB limit. Store screenshots are actual 1600×1000 PNG files with synthetic service data.
- Production browser fixture at 320×760: all seven languages passed document-language, translated launcher, no horizontal overflow, dialog containment, selector disabled while modal, dismissal focus restoration and saved preference checks. French command dialog and German dashboard were visually inspected. Translations have structural/functional validation, not professional native-speaker review.
- Production refresh fixtures: ready (one scan), delayed (two), denied (one), changed project (one), and no listener (four bounded scans) passed. Seven resource/history transitions retained identical card/action/memory bounds at narrow width.
- Native Muxy: German and Korean dashboard/command UI rendered; Korean custom-command launch created one grouped three-member service, without manual Refresh. Exact Terminal action returned to the recorded terminal; Open displayed the diagnostic PID in Muxy's browser. Restart removed the original wrapper/server/worker (4211/4212/4230, port 61350) before one replacement appeared (5548/5575/5576, port 61726). Stop removed the replacement tree. Read-only `ps` and `lsof` confirmed all six PIDs and both listeners absent. Existing inspection permission was reused; stop/launch requests were allowed once, without remembered changes.
- Both test terminals, the test browser, and saved `Release 0.3 smoke` command were removed. Original run-deck terminal selected. After the user unlocked the Mac, selected the original Chinese preference, restored Run Deck to its original disabled state and returned to the original PrintAnvil development terminal. No test process remains. Earlier native scenarios and automated safety coverage are documented above; occupied-port, sustained-alert and concurrent-context native tests were not repeated for this translation/UI release.
