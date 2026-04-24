<p align="center">
  <img src="assets/brand/eagle-markdown-icon.png" alt="Eagle Markdown icon" width="96" height="96">
</p>

# Eagle Markdown

A fast, native Markdown viewer built with [Tauri](https://tauri.app) and [pulldown-cmark](https://github.com/pulldown-cmark/pulldown-cmark).

[![Release](https://img.shields.io/github/v/release/eagleisbatman/eagle-markdown?style=flat-square)](https://github.com/eagleisbatman/eagle-markdown/releases)
[![License](https://img.shields.io/github/license/eagleisbatman/eagle-markdown?style=flat-square)](LICENSE)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue?style=flat-square)

## Download

Grab the latest release for your platform:

**[Download Eagle Markdown](https://github.com/eagleisbatman/eagle-markdown/releases/latest)**

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x86_64) |
| Windows | `.msi` installer |
| Linux | `.AppImage` / `.deb` |

> **macOS note:** Public macOS downloads should be Developer ID signed and notarized before release. That is the path that lets Gatekeeper verify the app without asking users to bypass system protections.

## Features

- **Fast rendering** --- Markdown is parsed in Rust via pulldown-cmark, not in the browser
- **Live reload** --- Edit a file in your editor, see changes instantly (file watching via `notify`)
- **Multi-tab** --- Open multiple files as tabs; drag-and-drop or Cmd+O to add
- **GitHub-Flavored Markdown** --- Tables, task lists, strikethrough, footnotes, smart punctuation, heading attributes
- **Syntax highlighting** --- 190+ languages via highlight.js with language labels and copy buttons
- **GitHub-style alerts** --- `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`
- **Dark & light mode** --- Follows your system preference automatically
- **YAML frontmatter** --- Silently stripped so your content renders clean
- **External links** --- Open in your default browser, not the app
- **Heading anchors** --- Hover any heading to get a linkable anchor
- **Responsive** --- Adapts to any window size
- **Native menus** --- Full macOS menu bar with About, keyboard shortcuts, and standard Edit actions
- **Tiny footprint** --- ~5 MB app bundle, instant startup

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open file | `Cmd+O` |
| Close tab | `Cmd+W` |
| Fullscreen | `Ctrl+Cmd+F` |
| Quit | `Cmd+Q` |

## Build from Source

**Prerequisites:** [Node.js](https://nodejs.org) (v18+), [Rust](https://rustup.rs) (stable), and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform.

```bash
# Clone
git clone https://github.com/eagleisbatman/eagle-markdown.git
cd eagle-markdown

# Install dependencies
npm install

# Run in development
npx tauri dev

# Build production app
npx tauri build --bundles app
```

The built `.app` (macOS), `.msi` (Windows), or `.AppImage` (Linux) will be in `src-tauri/target/release/bundle/`.

## Publish a macOS Release

For public macOS distribution outside the Mac App Store, use the release workflow with Apple Developer signing enabled:

1. Enroll in the Apple Developer Program.
2. Create a **Developer ID Application** certificate.
3. Export the certificate as a password-protected `.p12` and base64 encode it.
4. Add these GitHub Actions secrets:

| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` Developer ID certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | Certificate identity, for example `Developer ID Application: Name (TEAMID)` |
| `APPLE_ID` | Apple ID email used for notarization |
| `APPLE_PASSWORD` | App-specific password for that Apple ID |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

Then create and push a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The GitHub release should only be made public after the macOS artifacts are signed and notarized successfully. See [docs/release-macos.md](docs/release-macos.md) for the checklist.

## Open a file from the terminal

```bash
# During development
npx tauri dev -- -- /path/to/file.md

# With the built binary
./src-tauri/target/release/eagle-markdown /path/to/file.md
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Tauri v2](https://tauri.app) |
| Markdown parser | [pulldown-cmark](https://github.com/pulldown-cmark/pulldown-cmark) (Rust) |
| File watching | [notify](https://github.com/notify-rs/notify) (Rust, macOS FSEvents) |
| Frontend | [React 19](https://react.dev) + TypeScript |
| Syntax highlighting | [highlight.js](https://highlightjs.org) |
| Build tool | [Vite](https://vite.dev) |

## License

[MIT](LICENSE)
