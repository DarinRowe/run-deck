# Run Deck

[![CI](https://github.com/DarinRowe/run-deck/actions/workflows/ci.yml/badge.svg)](https://github.com/DarinRowe/run-deck/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A small development launchpad for Muxy. Save commands per worktree, launch them in Muxy terminals, jump to their output, and inspect listening ports when needed.

**Pure extension. No Python, Node runtime, helper binary, daemon, periodic polling, or duplicated terminal log buffer.** Node is only needed to build the source.

![Run Deck with saved commands, linked terminals, and on-demand port inspection](public/assets/screenshot-dark.png)

*Actual UI with synthetic fixture data and a simulated Muxy interface. [View the light theme and Chinese UI](public/assets/screenshot-light.png).*

## Install

Tested in Muxy 1.6.0. Requires a Muxy version with `storage`, terminal startup commands, and enriched terminal events. The implementation was checked against Muxy source `ab008599954afe683a48410b98b8f483adb96b40`; native app validation is tracked in [RELEASE.md](RELEASE.md).

### Download a release

1. Download `run-deck-0.1.0.zip` from [GitHub Releases](https://github.com/DarinRowe/run-deck/releases/latest) and extract it.
2. In Muxy, open **Extensions → Load Unpacked**, select the extracted `run-deck` folder containing `package.json`, and enable the extension.
3. Open **Run Deck: Toggle Launchpad** from the command palette, or click its terminal icon in the topbar/extension rail.

The ZIP is an unsigned local installation package. It needs no Node runtime. A `SHA256SUMS` file is included with each release for download verification. Marketplace publication is separate and requires upstream maintainer review.

### Build from source

Use Node 20.19+ on the 20.x line, or Node 22.12+ (Node 22 or 24 recommended).

```sh
git clone https://github.com/DarinRowe/run-deck.git
cd run-deck
npm ci
npm run build
```

Load the source `run-deck` folder using **Extensions → Load Unpacked**. Rebuild and click **Reload** after changing source.

There is no default keyboard shortcut to conflict with your existing bindings. Assign one in Muxy if desired.

## Use

- **Add command:** save a name, shell command, directory relative to the active worktree, and optional expected port.
- **Import scripts:** inspect the worktree's `package.json` and select a script. Nothing is installed or executed during discovery. npm, pnpm, Yarn, and Bun lockfiles select the command prefix.
- **Launch:** open a Muxy terminal after Muxy's normal execution consent. Output stays in that terminal.
- **Terminal:** focus the exact associated terminal.
- **Interrupt:** after confirmation, send Ctrl+C to the verified associated pane. This interrupts its current foreground command; it does not guarantee the original service has stopped.
- **Inspect ports:** run one bounded `lsof` request on the current execution host. No automatic rescans. Results show their snapshot time and are capped at 200 rows.
- **Forget terminal:** remove the association without stopping any process. Check Muxy's background sessions before launching again.
- **Remove:** delete the saved command only. Its terminal and processes are unchanged.

The UI supports English and Simplified Chinese and follows Muxy's light/dark theme.

### Status has a precise meaning

**Terminal open** means a linked terminal exists. A terminal can remain open after a command finishes. **Port listening** means a listener was present at inspection time, not that this command owns it or is healthy. **Terminal unavailable** can mean closed, detached, or absent from the current host layout; it does not prove the process stopped.

After an ambiguous launch response or interrupted save, Run Deck requires you to review the terminal and explicitly forget the association before retrying. It never silently retries a launch.

### Workspace and local-host behavior

Commands execute in the **active Muxy workspace**. In an SSH workspace, Muxy executes commands remotely. Run Deck does not claim it can force execution onto the Mac: the currently exposed host interface does not provide that guarantee. Port inspection uses macOS `/usr/sbin/lsof`; other remote operating systems are unsupported. Opening `localhost` requires explicit confirmation and targets the Mac; remote services need forwarding.

Saved commands are scoped by project and worktree IDs. Directories must stay inside the worktree; Muxy also checks symlinks. Do not put secrets directly into saved command text. Use your shell's existing environment or project tooling instead.

## Permissions

| Permission | Use |
| --- | --- |
| `panels:write` | Open and toggle the Run Deck panel. |
| `projects:read`, `worktrees:read` | Resolve the current worktree and isolate saved commands. |
| `storage:read`, `storage:write` | Store commands and terminal associations in Muxy's private extension storage. |
| `tabs:read`, `tabs:write` | Check, launch and focus associated terminals. |
| `panes:read`, `panes:write` | Verify the pane exists and send Ctrl+C after confirmation. |
| `commands:exec` | Run the explicit, read-only port inspection. |
| `files:read` | Read root package scripts and lockfile names on request. |
| `browser:write` | Open the user-selected localhost URL in Muxy's browser. |

No analytics, external network requests, telemetry, remote code loading, uploaded output, or automatic command execution. Commands and associations live in `muxy.storage`; language preference is local to the webview. No permissions are self-granted.

## Development

```sh
npm ci
npm run check
```

`npm run dev` serves the source for development. Open `/tests/preview.html` for an isolated, fake-host UI preview: it never runs shell commands. The test harness is excluded from `dist/`. Screenshot fixtures use synthetic names and paths. Listing screenshots are of this actual UI with a simulated Muxy interface, not proof of native integration.

`npm run check` runs the tests, production build, and distribution checks. GitHub Actions runs it on Node 20.19, 22, and 24.

See [CONTRIBUTING.md](CONTRIBUTING.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/VALIDATION.md](docs/VALIDATION.md), and [RELEASE.md](RELEASE.md).

## Contributing

Bug reports and focused pull requests are welcome. Please use English for issues, pull requests, and documentation when possible; the interface also supports Simplified Chinese. Read the [contribution guide](CONTRIBUTING.md) for setup, verification, and scope.

## Marketplace submission

Submit this source folder as `extensions/run-deck/` in a fork of [muxy-app/extensions](https://github.com/muxy-app/extensions). The official pipeline builds and signs `dist/` after maintainer approval; this is not an npm package. Follow [Muxy's contribution guide](https://muxy.app/docs/extensions/contributing).

## License

[MIT](LICENSE) © 2026 DarinRowe.

## 中文

Run Deck（运行台）把当前工作区的常用开发命令集中起来：保存命令、导入 package.json 脚本、启动和定位 Muxy 终端、确认后发送 Ctrl+C、按需检查端口。没有 Python、辅助进程或后台轮询。命令输出保留在 Muxy 终端中。

终端打开不等于服务健康，端口有人监听不等于归这条命令所有。关闭面板不停止服务；移除命令或解除关联也不停止进程。SSH 工作区在远端执行；第一版不是完整进程监管器，没有自动重启、退出码追踪和完成通知。
