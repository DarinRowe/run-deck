# Release workflow

Version 0.3.0 adds seven-language support and dashboard/launch refinements. Version 0.2.0 introduced the service dashboard. The earlier `v0.1.0` release contains the command launchpad. English release notes live in `docs/releases/<version>.md`.

## Before publishing

1. Update the version and English release notes. Keep the README installation instructions consistent with the artifact being released.
2. Commit the source and run `npm ci && npm run check` on macOS. The check includes a disposable real-process integration test.
3. Complete the Muxy smoke test below and update [Validation](docs/VALIDATION.md).
4. Push the release commit and wait for all CI jobs, including macOS process integration, to pass for that commit.
5. Package `dist/` under a single `run-deck/` directory in `run-deck-<version>.zip`. Generate `SHA256SUMS` and publish an annotated version tag with the ZIP and checksum.
6. Download the published assets and compare their checksum and contents to the verified build.

The ZIP is an unsigned local installation package. Users extract it and choose **Extensions → Load Unpacked**. Node is not required to run it.

## Native smoke test

Use [Develop and verify in Muxy](docs/MUXY-DEVELOPMENT.md) for the loading workflow, disposable baseline service, consent handling, and cleanup. This release checklist adds the broader behavior coverage required for publication.

- Load/reload the extension and verify automatic inspection, including consent cancellation without repeated prompts.
- Start a disposable HTTP server with a child worker through **Start command**. Verify one grouped row, per-member resources, and exact Terminal navigation. Check that interactive commands can still read terminal input.
- Open its page; verify the initial host confirmation and subsequent direct opening.
- Restart that tracked server. Verify all original members exit before a single replacement starts; an occupied port must cancel replacement startup.
- Stop the replacement tree; verify its listener and every observed member are gone.
- Verify live checks pause when hidden, during actions, and after consent cancellation. Resume with the user’s remembered inspection grant.
- Verify brief CPU spikes do not warn; sustained resource growth and repeated listener replacement appear inline and in Needs attention.
- Confirm an outside-project stop can be cancelled and a stale/changed identity cannot be signalled.
- Check remembered custom addresses, multiport rows, no-listener state, and failed-inspection state.
- Check all seven languages, light/dark themes, keyboard dismissal, and a narrow desktop panel.
- Clean up only the disposable test processes, tabs, files, and saved commands created for verification.

## Marketplace

Store publication is a separate contribution to [muxy-app/extensions](https://github.com/muxy-app/extensions). Re-run its current build, schema/listing validation, and package checks against this version; validation of the older launchpad is not evidence for the changed service permissions and behavior. Maintainer approval and signing are required before claiming a store release. [STORE-SUBMISSION.md](docs/STORE-SUBMISSION.md) contains draft English listing text.
