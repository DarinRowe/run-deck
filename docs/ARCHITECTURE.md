# Architecture

Run Deck is a single Muxy panel with vanilla ES modules. It does not declare `background`; enabled-but-closed operation needs no extension-owned host process. Muxy owns the terminal sessions and process lifecycle.

- `model.js`: bounded validation, storage decoding, worktree identity, terminal state and lsof parsing. No host calls.
- `controller.js`: host operations, serialized per-command mutations, bounded event map, persistent associations and context checks.
- `main.js`: accessible DOM, keyed command cards, modal form, deliberate actions and bilingual text.
- `style.css`: Muxy theme tokens and sizing; no production font downloads or theme-color duplication.

## Invariants

1. Launch intent is persisted before starting a command. An uncertain result blocks relaunch until the user reviews and forgets its association.
2. Commands are indexed under `v1/<projectID>/<worktreeID>/<commandID>`. Each command has its own storage key, avoiding whole-list overwrites.
3. Long-lived identities use host-generated tab/pane IDs. No PID or port is used to stop a process.
4. Ctrl+C is allowed only after confirmation and fresh context/tab/pane checks. It affects the terminal's current foreground program; that program may have changed since launch.
5. Port snapshots are separate from command identity and include a timestamp. No inferred ownership or health.
6. Read-only discovery never executes package scripts or installs packages. File inspection is limited to package metadata, with a 256 KiB package.json limit.
7. No periodic timer, resource charts, output streaming, terminal emulation, service worker, background script or hidden webview.
8. Launches and port requests do not retry automatically. Rapid clicks are coalesced within this panel. Muxy storage does not expose compare-and-swap; cross-window transactional launches are not claimed.

## Bounds

100 saved commands per worktree; 80-character names; 4096-character commands; 1024-character relative directory paths; 256 remembered terminal events; 200 port rows; one port request in flight; 5-second request timeout. Listener capture is still subject to the host's independent 10 MiB stdout/stderr caps before our parser runs. The UI owns no terminal log buffer. One dismiss timer exists only while a toast is visible.

## Host contract details

`tabs.open` receives a **relative** `directory`, because Muxy resolves it inside the worktree. Absolute paths are not interchangeable. `tabs.open` returns a tab ID; a pane ID is learned from enriched events and never guessed from titles. The pane event can arrive before or after the open response. If a verified pane ID cannot be recovered, interrupt is refused and the user can press Ctrl+C in the terminal directly.

An app session might restore terminal IDs differently. Missing associations are shown explicitly and never rebound by name. Panel state is rehydrated after recreation. No exact process exit status or background-detach mapping is currently exposed through the interface used here.

## Verification seam

Tests call the same controller as the UI using a fake host that implements the documented shapes. The browser harness imports the real production UI and model. Neither substitutes for a final Muxy-native smoke test, especially consent prompts, event ordering and WebKit behavior.
