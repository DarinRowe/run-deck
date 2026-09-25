# Run Deck development

- **Development:** Before changing panel UI, Muxy integration, runtime behavior, or the manifest, follow [MUXY-DEVELOPMENT.md](docs/MUXY-DEVELOPMENT.md) from contract lookup through native verification and cleanup. Report readiness only when its completion criteria pass; identify the exact blocked step otherwise. Documentation-only changes need link and instruction validation.
- **Architecture:** Before changing process inspection/signalling, asynchronous state/lifecycle, persistence, or worktree handling, read the [invariants](docs/ARCHITECTURE.md#invariants) and affected module's contract in the same document.
- **Release:** When publishing a version, follow [RELEASE.md](RELEASE.md) after development verification.
