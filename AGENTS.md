# Run Deck development

- **Native verification:** Before changing panel UI, Muxy integration, runtime behavior, or the extension manifest, read [docs/MUXY-DEVELOPMENT.md](docs/MUXY-DEVELOPMENT.md). Complete its build → load/reload → affected-flow → cleanup criteria before reporting the change ready. Use available native-app tools to perform the workflow; record the exact blocked step when the host cannot be reached. Documentation-only changes need link and instruction validation.
- **Architecture:** For process inspection, signalling, persistence, or worktree changes, read the invariants in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before editing.
- **Release:** When publishing a version, follow [RELEASE.md](RELEASE.md) after development verification.
