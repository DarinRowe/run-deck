# Contributing to Run Deck

Run Deck is a service dashboard for Muxy. Keep the main flow focused on seeing actual listeners, opening their pages, and stopping the intended process tree. Command launching is a secondary flow; Muxy owns its terminals and output.

## Get started

Fork this repository and clone your fork. Use Node 22.12+ or 24, then run:

```sh
npm ci
npm run check
npm run dev
```

Open the local development URL at `/tests/preview.html` for an isolated UI preview. It uses synthetic data and a fake Muxy interface; it never executes shell commands. Before completing a runtime or UI change, follow [Develop and verify in Muxy](docs/MUXY-DEVELOPMENT.md) to load the intended build and exercise the real host.

## Before opening a pull request

- Run `npm run check`. It covers controller/model tests, the production build, and distribution assertions.
- Add behavior tests when changing process inspection, signalling, browser addresses, persistence, or context isolation. The macOS integration tests start, restart, and stop only their own disposable services and worker trees; run them on macOS when changing inspection, launch wrappers, or signal guards.
- Check both languages and themes for UI changes. Keep English and Simplified Chinese strings in `src/i18n.js` consistent.
- Complete the affected-flow and cleanup criteria in [Develop and verify in Muxy](docs/MUXY-DEVELOPMENT.md), and report any exact blocked step. Scope native and fixture evidence to the build actually tested.
- Commit source and listing assets. Leave `dist/`, `node_modules/`, local environment files, and `release/` out of Git.

Use English for issues, pull requests, and documentation when possible. Explain the problem, the resulting behavior, and relevant validation. Include your Muxy version and operating system with bug reports; remove secrets, private commands, project paths, and process details from logs and screenshots.

## Design constraints

Preserve host consent, worktree isolation, and conservative process identity checks. Keep live checks serialized and foreground-only. Do not launch project commands automatically, add background polling, send force-kill signals, or duplicate terminal logs. Treat port inspection as a snapshot, never as proof of application health. Test through the same module interface used by the UI.

Read [Architecture](docs/ARCHITECTURE.md) for the invariants and [Validation](docs/VALIDATION.md) for current coverage and limits. Contributions are provided under the project's [MIT license](LICENSE).
