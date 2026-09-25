# Proposed store submission

Title: **run-deck 0.1.0 — lightweight development launchpad**

Run Deck saves development commands per Muxy worktree and opens them in native Muxy terminals. It lets users revisit the associated output, send Ctrl+C after confirmation, import package scripts without executing them, and inspect TCP listeners on demand. It has English and Simplified Chinese UI and follows the host theme.

The extension contains one vanilla-JavaScript panel, with no background script, runtime dependencies, helper binaries, network requests, periodic polling or terminal-output duplication. `commands:exec` is used only for a manual `/usr/sbin/lsof -nP -iTCP -sTCP:LISTEN -Fpcn` request with a five-second timeout. Expected ports never identify a process to kill. Terminal existence and port presence are explicitly distinguished from process health.

Validation: 21 automated tests; official build, schema/listing validation and pack dry-run; Muxy 1.6.0 native launch, interrupt, persistence, consent cancellation, port inspection, and import/launch of the project's own test script. The actual Muxy terminal reported 21 passed and 0 failed. Browser QA covered a 380 px panel and both languages/themes. Listing screenshots use synthetic data in the real UI with simulated host APIs.

Limitations: no automatic restart, health checks, exit-code tracking or force-stop. Native Send to Background and worktree switching during dialogs were not manually exercised; controller simulations cover the associated checks. Incremental WebKit memory and sustained CPU are unmeasured. Cross-window transactional launch locking is not claimed. macOS `lsof` is required for port inspection. The previously documented esbuild advisory was resolved before GitHub publication; no npm runtime dependencies are shipped.

Author/GitHub: **DarinRowe**. License: MIT. Developed with OpenAI Codex (GPT-6). Adapt this text to the official repository's PR template when submitting; no PR has been opened and this is not yet listed in the store.
