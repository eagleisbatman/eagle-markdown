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

> **macOS note:** On first launch, macOS will block the app since it isn't notarized. **Right-click** the app → **Open** → click **Open** again. You only need to do this once. If you see "damaged", run `xattr -cr /Applications/Eagle\ Markdown.app` in Terminal first.

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
