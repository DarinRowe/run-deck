# Draft store submission

**Run Deck — see what’s running, open it, stop it.**

A focused desktop service dashboard for Muxy on macOS. See development services, combined CPU, and estimated resident memory at a glance. Related listeners and workers share one row; current-project services appear first and app/system processes stay collapsed. Open a service, inspect its process tree, or stop verified processes. For launches recorded by Run Deck, jump directly to the terminal or restart the saved command after checking the old tree has exited.

Live checks run every five seconds while visible and pause during dialogs/actions or when hidden. Sustained CPU, growing memory, and repeated listener replacements appear inline, with a Needs attention filter. There is no background extension runtime, daemon, telemetry, or duplicated terminal output. English and Simplified Chinese follow the host theme.

Stop rechecks host, owner, process identities, tree membership, and listening ports before TERM; no force kill is used. Restart never guesses commands for external services. macOS inspection tools are required. A listening port is not a health check, RSS totals are estimates, and non-listening standalone jobs are outside discovery. Default browser opening confirms host mapping because execution may be remote.

The dashboard is not yet submitted to the marketplace. See [Validation](VALIDATION.md) for current evidence. Repeat official package/listing validation before submission. Author: DarinRowe. License: MIT. Developed with OpenAI Codex.
