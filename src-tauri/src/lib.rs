use pulldown_cmark::{html, CodeBlockKind, Event, Options, Parser, Tag, TagEnd};
use serde::Serialize;
use std::sync::Mutex;
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItem, SubmenuBuilder};
use tauri::Emitter;

const MAX_MARKDOWN_BYTES: u64 = 10 * 1024 * 1024;

// --- State ---

#[derive(Default)]
struct WatcherState {
    watcher: Option<notify::RecommendedWatcher>,
    watched_path: Option<String>,
}

// --- Types ---

#[derive(Serialize)]
struct FileData {
    path: String,
    html: String,
}

// --- Helpers ---

fn strip_frontmatter(input: &str) -> &str {
    if !input.starts_with("---") {
        return input;
    }
    let after = if input.starts_with("---\r\n") {
        &input[5..]
    } else if input.starts_with("---\n") {
        &input[4..]
    } else {
        return input;
    };
    match after.find("\n---") {
        Some(pos) => {
            let rest = &after[pos + 4..];
            rest.strip_prefix("\r\n")
                .or_else(|| rest.strip_prefix('\n'))
                .unwrap_or(rest)
        }
        None => input,
    }
}

fn escape_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(c),
        }
    }
    out
}

fn is_markdown_path(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| matches!(ext.to_ascii_lowercase().as_str(), "md" | "mdx" | "markdown"))
        .unwrap_or(false)
}

fn normalize_code_language(language: &str) -> String {
    language
        .split([',', ' '])
        .next()
        .unwrap_or("")
        .trim()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '+'))
        .collect()
}

// --- Markdown rendering ---

fn markdown_to_html(input: &str) -> String {
    let content = strip_frontmatter(input);

    let mut opts = Options::empty();
    opts.insert(Options::ENABLE_TABLES);
    opts.insert(Options::ENABLE_STRIKETHROUGH);
    opts.insert(Options::ENABLE_TASKLISTS);
    opts.insert(Options::ENABLE_FOOTNOTES);
    opts.insert(Options::ENABLE_SMART_PUNCTUATION);
    opts.insert(Options::ENABLE_HEADING_ATTRIBUTES);

    let parser = Parser::new_ext(content, opts);

    let mut events: Vec<Event> = Vec::new();
    let mut in_code = false;
    let mut code_lang = String::new();
    let mut code_text = String::new();

    for event in parser {
        if in_code {
            match event {
                Event::Text(t) => code_text.push_str(&t),
                Event::End(TagEnd::CodeBlock) => {
                    in_code = false;
                    let escaped = escape_html(&code_text);
                    let lang_class = if !code_lang.is_empty() {
                        format!(" class=\"language-{}\"", escape_html(&code_lang))
                    } else {
                        String::new()
                    };
                    let lang_label = if !code_lang.is_empty() {
                        format!(
                            "<span class=\"code-lang\">{}</span>",
                            escape_html(&code_lang)
                        )
                    } else {
                        String::new()
                    };
                    events.push(Event::Html(
                        format!(
                            "<div class=\"code-block\"><div class=\"code-header\">{}</div><pre><code{}>{}</code></pre></div>\n",
                            lang_label, lang_class, escaped
                        )
                        .into(),
                    ));
                }
                _ => {}
            }
            continue;
        }

        match event {
            Event::Start(Tag::CodeBlock(kind)) => {
                code_lang = match &kind {
                    CodeBlockKind::Fenced(lang) => normalize_code_language(lang),
                    CodeBlockKind::Indented => String::new(),
                };
                code_text.clear();
                in_code = true;
            }
            Event::Html(raw) | Event::InlineHtml(raw) => events.push(Event::Text(raw)),
            other => events.push(other),
        }
    }

    let mut html_output = String::new();
    html::push_html(&mut html_output, events.into_iter());
    html_output
}

// --- Commands ---

#[tauri::command]
fn render_markdown(input: &str) -> String {
    markdown_to_html(input)
}

#[tauri::command]
fn render_file(path: &str) -> Result<FileData, String> {
    let path_ref = std::path::Path::new(path);

    if !is_markdown_path(path_ref) {
        return Err("Eagle Markdown can only open .md, .mdx, or .markdown files.".into());
    }

    let metadata = std::fs::metadata(path_ref).map_err(|e| e.to_string())?;
    if metadata.len() > MAX_MARKDOWN_BYTES {
        return Err("That Markdown file is larger than the 10 MB safety limit.".into());
    }

    let canonical_path = std::fs::canonicalize(path_ref).map_err(|e| e.to_string())?;
    let content = std::fs::read_to_string(&canonical_path).map_err(|e| e.to_string())?;
    let html = markdown_to_html(&content);
    Ok(FileData {
        path: canonical_path.to_string_lossy().to_string(),
        html,
    })
}

#[tauri::command]
fn watch_file(
    path: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<WatcherState>>,
) -> Result<(), String> {
    use notify::{RecursiveMode, Watcher};

    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.watcher = None;
    state.watched_path = None;

    let watched_path = path.clone();
    let app_handle = app.clone();

    let watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        if let Ok(event) = res {
            if matches!(event.kind, notify::EventKind::Modify(_)) {
                let target = std::path::Path::new(&watched_path);
                if event.paths.iter().any(|p| p == target) {
                    let _ = app_handle.emit("file-changed", watched_path.clone());
                }
            }
        }
    })
    .map_err(|e| e.to_string())?;

    let file_path = std::path::Path::new(&path);
    let watch_dir = file_path.parent().unwrap_or(file_path);
    let mut watcher = watcher;
    watcher
        .watch(watch_dir, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    state.watcher = Some(watcher);
    state.watched_path = Some(path);
    Ok(())
}

#[tauri::command]
fn unwatch_file(state: tauri::State<'_, Mutex<WatcherState>>) -> Result<(), String> {
    let mut state = state.lock().map_err(|e| e.to_string())?;
    state.watcher = None;
    state.watched_path = None;
    Ok(())
}

#[tauri::command]
fn get_initial_file() -> Option<String> {
    std::env::args().skip(1).find_map(|arg| {
        let path = std::path::Path::new(&arg);
        if path.exists() && is_markdown_path(path) {
            std::fs::canonicalize(path)
                .ok()
                .map(|p| p.to_string_lossy().to_string())
        } else {
            None
        }
    })
}

// --- App entry ---

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(WatcherState::default()))
        .menu(|handle| {
            let open_item =
                MenuItem::with_id(handle, "open", "Open\u{2026}", true, Some("CmdOrCtrl+O"))?;
            let close_tab =
                MenuItem::with_id(handle, "close_tab", "Close Tab", true, Some("CmdOrCtrl+W"))?;

            let app_sub = SubmenuBuilder::new(handle, "Eagle Markdown")
                .about(Some(AboutMetadata {
                    name: Some("Eagle Markdown".into()),
                    version: Some(env!("CARGO_PKG_VERSION").into()),
                    copyright: Some("\u{00a9} 2024 Eagle".into()),
                    comments: Some("A fast, native Markdown viewer built with Tauri".into()),
                    ..Default::default()
                }))
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let file_sub = SubmenuBuilder::new(handle, "File")
                .item(&open_item)
                .item(&close_tab)
                .separator()
                .close_window()
                .build()?;

            let edit_sub = SubmenuBuilder::new(handle, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let view_sub = SubmenuBuilder::new(handle, "View").fullscreen().build()?;

            let window_sub = SubmenuBuilder::new(handle, "Window")
                .minimize()
                .maximize()
                .separator()
                .close_window()
                .build()?;

            MenuBuilder::new(handle)
                .item(&app_sub)
                .item(&file_sub)
                .item(&edit_sub)
                .item(&view_sub)
                .item(&window_sub)
                .build()
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                let _ = app.emit("menu-open", ());
            }
            "close_tab" => {
                let _ = app.emit("menu-close-tab", ());
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            render_markdown,
            render_file,
            watch_file,
            unwatch_file,
            get_initial_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Eagle Markdown");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn markdown_renderer_escapes_raw_html() {
        let html = markdown_to_html("# Safe\n<script>alert('xss')</script>");

        assert!(html.contains("&lt;script&gt;"));
        assert!(!html.contains("<script>"));
    }

    #[test]
    fn fenced_code_language_is_normalized() {
        let html = markdown_to_html("```rust onclick=bad\nfn main() {}\n```");

        assert!(html.contains("language-rust"));
        assert!(!html.contains("onclick"));
    }

    #[test]
    fn frontmatter_is_removed_before_rendering() {
        let html = markdown_to_html("---\ntitle: Demo\n---\n# Heading");

        assert!(!html.contains("title: Demo"));
        assert!(html.contains("<h1>Heading</h1>"));
    }
}
