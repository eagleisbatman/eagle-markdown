---
title: Eagle Markdown Test
author: eagle
---

# Eagle Markdown

A fast, native markdown viewer built with **Tauri v2** and **pulldown-cmark**.

## Code Blocks

### Rust

```rust
use std::collections::HashMap;

fn fibonacci(n: u64) -> u64 {
    let mut memo = HashMap::new();
    fn fib(n: u64, memo: &mut HashMap<u64, u64>) -> u64 {
        if n <= 1 { return n; }
        if let Some(&val) = memo.get(&n) { return val; }
        let result = fib(n - 1, memo) + fib(n - 2, memo);
        memo.insert(n, result);
        result
    }
    fib(n, &mut memo)
}

fn main() {
    for i in 0..20 {
        println!("fib({}) = {}", i, fibonacci(i));
    }
}
```

### TypeScript

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  roles: ("admin" | "editor" | "viewer")[];
}

async function fetchUsers(page: number): Promise<User[]> {
  const response = await fetch(`/api/users?page=${page}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}
```

### Python

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class Config:
    host: str = "localhost"
    port: int = 8080
    debug: bool = False
    db_url: Optional[str] = None

    def connection_string(self) -> str:
        return f"http://{self.host}:{self.port}"
```

### Shell

```bash
#!/bin/bash
set -euo pipefail

echo "Building Eagle Markdown..."
npm run build
cargo build --release
echo "Done! Binary at target/release/eagle-markdown"
```

### Plain code block (no language)

    This is an indented code block.
    It has no language specified.
    Should still render cleanly.

## Tables

### Feature Matrix

| Feature | Status | Priority | Owner |
|:--------|:------:|:--------:|------:|
| File open dialog | Done | P0 | @eagle |
| Live reload | Done | P0 | @eagle |
| Drag & drop | Done | P1 | @eagle |
| Syntax highlighting | Done | P1 | @eagle |
| Multi-tab support | Done | P1 | @eagle |
| PDF export | Planned | P2 | TBD |
| Vim keybindings | Backlog | P3 | — |

### Comparison

| Library | Language | GFM Tables | Task Lists | Footnotes | Speed |
|---------|----------|:----------:|:----------:|:---------:|-------|
| pulldown-cmark | Rust | Yes | Yes | Yes | Fast |
| markdown-it | JavaScript | Plugin | Plugin | Plugin | Medium |
| commonmark.js | JavaScript | No | No | No | Medium |
| marked | JavaScript | Yes | Yes | No | Fast |
| pandoc | Haskell | Yes | Yes | Yes | Slow |

## Task Lists

### Sprint Progress

- [x] Set up Tauri v2 project scaffold
- [x] Implement pulldown-cmark rendering
- [x] Add file watcher with debounce
- [x] Build tab management system
- [x] Style code blocks with language labels and copy buttons
- [ ] Add PDF export via headless browser
- [ ] Implement search within document (Cmd+F overlay)
- [ ] Add table of contents sidebar
- [ ] Support Mermaid diagram rendering

### Nested Tasks

- [x] Phase 1: Core viewer
  - [x] Markdown parsing
  - [x] HTML rendering
  - [x] File I/O
- [ ] Phase 2: Enhanced features
  - [x] Syntax highlighting
  - [x] GitHub-style alerts
  - [ ] Math rendering (KaTeX)
  - [ ] Diagram support

## Alerts

> [!NOTE]
> This viewer uses pulldown-cmark on the Rust side for fast, correct GFM parsing. All rendering happens natively — no Electron overhead.

> [!TIP]
> You can drag multiple `.md` files onto the window to open them all as tabs. Use **Cmd+W** to close the active tab.

> [!IMPORTANT]
> File watching uses macOS FSEvents through the `notify` crate. Changes are debounced at 150ms to avoid excessive re-renders.

> [!WARNING]
> Large markdown files (>10MB) may cause noticeable rendering delay. Consider splitting very large documents.

> [!CAUTION]
> The `dangerouslySetInnerHTML` prop is used to inject rendered HTML. While pulldown-cmark output is generally safe, avoid rendering untrusted markdown from external sources without sanitization.

## Blockquotes

> "The best way to predict the future is to invent it."
> — Alan Kay

> Nested blockquotes work too:
>
> > This is a nested quote.
> > It can span multiple lines.

## Text Formatting

This paragraph has **bold text**, *italic text*, and ***bold italic***. You can also use ~~strikethrough~~ for deleted text. Inline `code` looks like this, and here's a longer inline snippet: `const x = fn(() => value)`.

## Links & Images

Visit [Eagle Markdown on GitHub](https://github.com/example) for the source code.

Here's an auto-linked URL: https://tauri.app

## Lists

### Ordered

1. First item with a longer description that might wrap to the next line if the window is narrow enough
2. Second item
3. Third item
   1. Nested ordered item
   2. Another nested item

### Unordered

- Apples
- Oranges
  - Blood orange
  - Navel orange
- Bananas

## Horizontal Rules

Above the rule.

---

Below the rule.

## Footnotes

This viewer is built with Tauri[^1] and uses pulldown-cmark[^2] for parsing.

[^1]: Tauri is a framework for building tiny, fast binaries for all major desktop platforms.
[^2]: pulldown-cmark is a pull parser for CommonMark, written in Rust.

---

*Built with pulldown-cmark + Tauri v2 + React*
