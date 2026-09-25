# Release 0.1.0

Source folder: `run-deck`. Marketplace author and GitHub handle: `DarinRowe`.

## GitHub release

The public source repository is [DarinRowe/run-deck](https://github.com/DarinRowe/run-deck). Releases use English notes and include an unsigned installable ZIP plus `SHA256SUMS`.

1. Commit the release source and run `npm ci && npm run check` on that commit.
2. Push to `main` and wait for all GitHub Actions CI jobs to pass for the same commit.
3. Package the contents of `dist/` under a single `run-deck/` directory in `run-deck-<version>.zip`. Exclude source, tests, dependencies, and local files. Generate a SHA-256 checksum for the ZIP.
4. Create an annotated `v<version>` tag at the verified commit, then publish a GitHub release with the ZIP, checksum, installation instructions, and known limitations.
5. Download the published assets and verify the checksum and packaged contents against the local build.

Users extract the ZIP and load its `run-deck` directory using **Extensions → Load Unpacked**. It does not require Node. GitHub publication does not imply marketplace approval or signing.

## Before submitting to the marketplace

- Run `npm ci && npm run check`.
- Complete the native Muxy smoke test below.
- Put this source folder under `extensions/run-deck/` in a sparse checkout of your fork of `muxy-app/extensions`.
- At the repository root, run `npm ci`, `node scripts/build.mjs run-deck`, `node scripts/validate.mjs run-deck`, and `node scripts/pack.mjs --dry-run run-deck`.
- Commit source and listing assets; exclude `dist/`, `node_modules/`, and `release/`.
- Open a PR titled **run-deck 0.1.0**, using the repository's current PR template. State that this contribution was developed with OpenAI Codex (GPT-6), and disclose any remaining validation gaps.
- Publishing occurs after maintainer review and merge. A locally generated ZIP is unsigned; do not describe it as a store-signed release.

## Validation status

The core native smoke test passed in Muxy 1.6.0. Automated checks and official marketplace build/validation/packing also passed. See [docs/VALIDATION.md](docs/VALIDATION.md) for evidence and explicit limits.

- [x] Load Unpacked, enable, open via topbar, and reload after a build.
- [x] Save and launch a harmless command; verify terminal output.
- [x] Cancel launch consent; verify review/forget flow and no automatic retry.
- [x] Launch `sleep 300`, confirm Interrupt, and verify the process exits.
- [x] Close/reopen the panel; verify persisted entries and terminal focus.
- [x] Close a linked terminal; verify “Terminal unavailable.”
- [x] Inspect ports with execution allowed/cancelled; distinguish failure from an empty scan.
- [x] Import the project's actual `test` script without auto-running; launch it explicitly and obtain 21 passing tests in Muxy.
- [x] Check Chinese/native light UI and browser light/dark screenshots, Escape cancellation, and a 380 px narrow layout.
- [ ] Native switch-worktree-during-editor and Send to Background tests; covered by controller simulations only.
- [ ] Sustained CPU and incremental WebKit memory benchmark. No numeric memory claim is made.

## Listing text

**Run Deck — a lightweight development launchpad for Muxy.** Save commands per worktree, launch and revisit Muxy terminals, interrupt a verified terminal after confirmation, and inspect ports on demand. English and Chinese UI. No daemon, periodic polling or duplicated terminal log buffer.

Screenshots show the real plugin UI with synthetic fixture data and simulated Muxy APIs. Native layout was also checked in the running app. The fixture images avoid exposing a user's project sidebar or local process list.
