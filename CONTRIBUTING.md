# Contributing to Run Deck

Run Deck is a small command launchpad for Muxy. Keep changes focused on saving commands, interacting with Muxy terminals, and inspecting ports on request. Muxy owns process execution and terminal output.

## Get started

Fork this repository and clone your fork. Use Node 22.12+ or 24, then run:

```sh
npm ci
npm run check
npm run dev
```

Open the local development URL at `/tests/preview.html` for an isolated UI preview. It uses synthetic data and a fake Muxy interface; it never executes shell commands. To test native integration, run `npm run build`, load the source folder through Muxy's **Extensions → Load Unpacked**, and reload after rebuilding.

## Before opening a pull request

- Run `npm run check`. It covers controller/model tests, the production build, and distribution assertions.
- Add or update behavior tests when changing command execution, persistence, context isolation, or terminal associations.
- Check both languages and themes for UI changes. Keep English and Simplified Chinese strings in `src/i18n.js` consistent.
- Exercise affected behavior in Muxy and describe what you checked. Clearly distinguish native verification from the fake-host preview.
- Commit source and listing assets. Leave `dist/`, `node_modules/`, local environment files, and `release/` out of Git.

Use English for issues, pull requests, and documentation when possible. Explain the problem, the resulting behavior, and relevant validation. Include your Muxy version and operating system with bug reports; remove secrets, private commands, project paths, and process details from logs and screenshots.

## Design constraints

Preserve explicit consent, worktree isolation, and conservative terminal associations. Do not add automatic command execution, background polling, telemetry, or duplicated terminal logs. Treat port inspection as a snapshot, never as proof of process ownership or health.

Read [Architecture](docs/ARCHITECTURE.md) for the invariants and [Validation](docs/VALIDATION.md) for current coverage and limits. Contributions are provided under the project's [MIT license](LICENSE).
