import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
  type CSSProperties,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import hljs from "highlight.js/lib/common";
import brandMark from "./assets/brand/eagle-markdown-mark.svg";

interface FileData {
  path: string;
  html: string;
}

interface Tab {
  id: string;
  path: string;
  name: string;
  html: string;
}

const THEME_OPTIONS = [
  { id: "system", label: "System" },
  { id: "paper", label: "Paper" },
  { id: "night", label: "Night" },
  { id: "beach", label: "Beach" },
  { id: "classic", label: "Classic" },
  { id: "forest", label: "Forest" },
] as const;

type ThemeMode = (typeof THEME_OPTIONS)[number]["id"];

let nextId = 0;
const PAGE_ASPECT_RATIO = 0.86;
const MIN_PAGE_WIDTH = 320;
const SINGLE_PAGE_BREAKPOINT = 940;

function shouldKeepWithNext(node: HTMLElement) {
  return /^H[1-6]$/.test(node.tagName);
}

function calculateReaderSize(container: HTMLElement) {
  const { width, height } = container.getBoundingClientRect();
  const shouldUseSinglePage = width < SINGLE_PAGE_BREAKPOINT;
  const sideControlSpace = shouldUseSinglePage ? 104 : 176;
  const verticalControlSpace = 76;
  const availableWidth = Math.max(width - sideControlSpace, MIN_PAGE_WIDTH);
  const availableHeight = Math.max(height - verticalControlSpace, 420);

  if (shouldUseSinglePage) {
    const pageHeight = availableHeight;
    const pageWidth = Math.min(availableWidth, pageHeight * PAGE_ASPECT_RATIO);
    return { pageWidth, pageHeight, shouldUseSinglePage };
  }

  let pageWidth = availableWidth / 2;
  let pageHeight = pageWidth / PAGE_ASPECT_RATIO;

  if (pageHeight > availableHeight) {
    pageHeight = availableHeight;
    pageWidth = pageHeight * PAGE_ASPECT_RATIO;
  }

  pageWidth = Math.max(pageWidth, MIN_PAGE_WIDTH);
  return { pageWidth, pageHeight, shouldUseSinglePage };
}

function groupPageNodes(nodes: HTMLElement[]) {
  const groups: HTMLElement[][] = [];
  let index = 0;

  while (index < nodes.length) {
    const node = nodes[index];

    if (shouldKeepWithNext(node) && nodes[index + 1]) {
      groups.push([node, nodes[index + 1]]);
      index += 2;
      continue;
    }

    groups.push([node]);
    index += 1;
  }

  return groups;
}

function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [readerSize, setReaderSize] = useState({
    pageWidth: 520,
    pageHeight: 680,
    shouldUseSinglePage: false,
  });
  const [turnDirection, setTurnDirection] = useState<"next" | "previous">(
    "next",
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = window.localStorage.getItem("eagle-markdown-theme");
    return THEME_OPTIONS.some((option) => option.id === saved)
      ? (saved as ThemeMode)
      : "system";
  });
  const mainRef = useRef<HTMLElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const measurerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);
  const tabsRef = useRef<Tab[]>([]);
  const activeRef = useRef<string | null>(null);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);
  useEffect(() => {
    activeRef.current = activeTabId;
  }, [activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const lastPageIndex = Math.max(pages.length - 1, 0);
  const visiblePageIndexes =
    readerSize.shouldUseSinglePage ||
    pages.length <= 1 ||
    pageIndex === 0 ||
    pageIndex === lastPageIndex
      ? [Math.min(pageIndex, lastPageIndex)]
      : [pageIndex, Math.min(pageIndex + 1, lastPageIndex)];

  const currentSpreadLabel =
    pages.length > 0
      ? visiblePageIndexes.length === 1
        ? `Page ${visiblePageIndexes[0] + 1} of ${pages.length}`
        : `Pages ${visiblePageIndexes[0] + 1}-${visiblePageIndexes[1] + 1} of ${
            pages.length
          }`
      : "";
  const readerStyle = {
    "--reader-page-width": `${Math.round(readerSize.pageWidth)}px`,
    "--reader-page-height": `${Math.round(readerSize.pageHeight)}px`,
  } as CSSProperties;

  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage(null);
    }, 3200);
  }, []);

  const enhanceMarkdown = useCallback(
    (el: HTMLElement) => {
      // Syntax highlighting
      el.querySelectorAll("pre code[class*='language-']").forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });

      // Copy buttons
      el.querySelectorAll(".code-header").forEach((header) => {
        let btn = header.querySelector<HTMLButtonElement>(".copy-btn");
        if (!btn) {
          btn = document.createElement("button");
          btn.className = "copy-btn";
          btn.textContent = "Copy";
          header.appendChild(btn);
        }
        btn.onclick = () => {
          const code =
            header.parentElement?.querySelector("code")?.textContent ?? "";
          navigator.clipboard
            .writeText(code)
            .then(() => {
              btn.textContent = "Copied";
              setTimeout(() => (btn.textContent = "Copy"), 2000);
            })
            .catch(() => showStatus("Could not copy that code block."));
        };
        btn.setAttribute("type", "button");
      });

      // Heading anchors
      el.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
        if (h.querySelector(".heading-anchor")) return;
        const text = h.textContent ?? "";
        const slug = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/^-+|-+$/g, "");
        h.id = slug;
        const a = document.createElement("a");
        a.className = "heading-anchor";
        a.href = `#${slug}`;
        a.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-.025 9.45a.75.75 0 01-1.06-1.06l-1.25 1.25a2 2 0 01-2.83-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25z"/></svg>';
        a.setAttribute("aria-hidden", "true");
        h.insertBefore(a, h.firstChild);
      });

      // Table wrappers for horizontal scroll
      el.querySelectorAll("table").forEach((table) => {
        if (table.parentElement?.classList.contains("table-wrapper")) return;
        const wrapper = document.createElement("div");
        wrapper.className = "table-wrapper";
        table.parentNode?.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      });

      // GitHub-style alert callouts
      el.querySelectorAll("blockquote").forEach((bq) => {
        const firstP = bq.querySelector("p");
        if (!firstP || firstP.querySelector(".alert-title")) return;
        const m = firstP.innerHTML.match(
          /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/,
        );
        if (!m) return;
        const kind = m[1].toLowerCase();
        bq.classList.add("alert", `alert-${kind}`);
        const icons: Record<string, string> = {
          note: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 8a8 8 0 1116 0A8 8 0 010 8zm8-6.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM6.5 7.75A.75.75 0 017.25 7h1a.75.75 0 01.75.75v2.75h.25a.75.75 0 010 1.5h-2a.75.75 0 010-1.5h.25v-2h-.25a.75.75 0 01-.75-.75zM8 6a1 1 0 110-2 1 1 0 010 2z"/></svg>',
          tip: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 01-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 00-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.75.75 0 01-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75zM6 15.25a.75.75 0 01.75-.75h2.5a.75.75 0 010 1.5h-2.5a.75.75 0 01-.75-.75zM5.75 12a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z"/></svg>',
          important:
            '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0114.25 13H8.06l-2.573 2.573A1.458 1.458 0 013 14.543V13H1.75A1.75 1.75 0 010 11.25zm1.75-.25a.25.25 0 00-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 01.75.75v2.19l2.72-2.72a.749.749 0 01.53-.22h6.5a.25.25 0 00.25-.25v-9.5a.25.25 0 00-.25-.25zm7 2.25v2.5a.75.75 0 01-1.5 0v-2.5a.75.75 0 011.5 0zM9 9a1 1 0 11-2 0 1 1 0 012 0z"/></svg>',
          warning:
            '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575zm1.763.707a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368zm.53 3.996v2.5a.75.75 0 01-1.5 0v-2.5a.75.75 0 011.5 0zM9 11a1 1 0 11-2 0 1 1 0 012 0z"/></svg>',
          caution:
            '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4.47.22A.749.749 0 015 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 01-.22.53l-4.25 4.25A.749.749 0 0111 16H5a.749.749 0 01-.53-.22L.22 11.53A.749.749 0 010 11V5c0-.199.079-.389.22-.53zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5zM8 4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 8a1 1 0 110-2 1 1 0 010 2z"/></svg>',
        };
        const label = m[1].charAt(0) + m[1].slice(1).toLowerCase();
        firstP.innerHTML = firstP.innerHTML.replace(
          m[0],
          `<span class="alert-title">${icons[kind] ?? ""} ${label}</span><br/>`,
        );
      });

      // External links -> open in default browser
      el.querySelectorAll("a[href]").forEach((link) => {
        const href = link.getAttribute("href") ?? "";
        if (href.startsWith("http://") || href.startsWith("https://")) {
          (link as HTMLAnchorElement).onclick = (e) => {
            e.preventDefault();
            openUrl(href);
          };
          link.setAttribute("target", "_blank");
          link.classList.add("external-link");
        } else if (href.startsWith("#")) {
          (link as HTMLAnchorElement).onclick = (e) => {
            e.preventDefault();
            document
              .getElementById(href.slice(1))
              ?.scrollIntoView({ behavior: "smooth" });
          };
        }
      });
    },
    [showStatus],
  );

  const turnTo = useCallback(
    (nextIndex: number) => {
      const bounded = Math.max(0, Math.min(nextIndex, lastPageIndex));
      if (bounded === pageIndex) return;
      setTurnDirection(bounded > pageIndex ? "next" : "previous");
      setPageIndex(bounded);
    },
    [lastPageIndex, pageIndex],
  );

  const turnNext = useCallback(() => {
    turnTo(pageIndex + 1);
  }, [pageIndex, turnTo]);

  const turnPrevious = useCallback(() => {
    turnTo(pageIndex - 1);
  }, [pageIndex, turnTo]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem("eagle-markdown-theme", themeMode);
  }, [themeMode]);

  useLayoutEffect(() => {
    const container = mainRef.current;
    if (!container) return;

    const updateReaderSize = () => {
      setReaderSize(calculateReaderSize(container));
    };

    updateReaderSize();

    const observer = new ResizeObserver(updateReaderSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!activeTab || !measurerRef.current) {
      setPages([]);
      setPageIndex(0);
      return;
    }

    let frame = 0;
    const paginate = () => {
      const measurer = measurerRef.current;
      if (!measurer) return;

      measurer.innerHTML = activeTab.html;
      enhanceMarkdown(measurer);

      const sourceNodes = Array.from(measurer.children).map((node) =>
        node.cloneNode(true) as HTMLElement,
      );
      const nodeGroups = groupPageNodes(sourceNodes);
      const maxHeight = measurer.clientHeight;
      const nextPages: string[] = [];
      let currentNodes: string[] = [];

      measurer.innerHTML = "";

      for (const group of nodeGroups) {
        for (const node of group) {
          measurer.appendChild(node.cloneNode(true));
        }

        if (measurer.scrollHeight > maxHeight && currentNodes.length > 0) {
          nextPages.push(currentNodes.join(""));
          currentNodes = group.map((node) => node.outerHTML);
          measurer.innerHTML = currentNodes.join("");
        } else {
          currentNodes.push(...group.map((node) => node.outerHTML));
        }
      }

      if (currentNodes.length > 0) {
        nextPages.push(currentNodes.join(""));
      }

      const nonEmptyPages = nextPages.filter((page) => page.trim().length > 0);
      setPages(nonEmptyPages.length > 0 ? nonEmptyPages : [""]);
      setPageIndex(0);
      measurer.innerHTML = "";
    };

    frame = window.requestAnimationFrame(paginate);
    window.addEventListener("resize", paginate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", paginate);
    };
  }, [activeTab?.html, activeTabId, enhanceMarkdown, readerSize]);

  // --- Post-process visible pages ---
  useEffect(() => {
    const el = viewerRef.current;
    if (!el || !activeTab) return;
    enhanceMarkdown(el);
  }, [activeTab, enhanceMarkdown, pages, pageIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeTab) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        turnNext();
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        turnPrevious();
      }
      if (event.key === "Home") {
        event.preventDefault();
        turnTo(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        turnTo(lastPageIndex);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, lastPageIndex, turnNext, turnPrevious, turnTo]);

  // --- File operations ---

  const openFile = useCallback(async (path: string) => {
    const existing = tabsRef.current.find((t) => t.path === path);
    if (existing) {
      setActiveTabId(existing.id);
      try {
        const result = await invoke<FileData>("render_file", { path });
        setTabs((prev) =>
          prev.map((t) =>
            t.id === existing.id ? { ...t, html: result.html } : t,
          ),
        );
      } catch (err) {
        console.error("Failed to refresh:", err);
        showStatus(`Could not refresh ${existing.name}.`);
      }
      return;
    }

    try {
      const result = await invoke<FileData>("render_file", { path });
      const name = result.path.split("/").pop() ?? "Unknown";
      const id = `tab-${++nextId}`;
      setTabs((prev) => [
        ...prev,
        { id, path: result.path, name, html: result.html },
      ]);
      setActiveTabId(id);
      await getCurrentWindow().setTitle(`${name} \u2014 Eagle Markdown`);
      await invoke("watch_file", { path: result.path });
    } catch (err) {
      console.error("Failed to open file:", err);
      showStatus(err instanceof Error ? err.message : String(err));
    }
  }, [showStatus]);

  const closeTab = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      if (id === activeRef.current) {
        if (next.length > 0) {
          const ni = Math.min(idx, next.length - 1);
          setActiveTabId(next[ni].id);
          invoke("watch_file", { path: next[ni].path }).catch(() => {});
          getCurrentWindow()
            .setTitle(`${next[ni].name} \u2014 Eagle Markdown`)
            .catch(() => {});
        } else {
          setActiveTabId(null);
          invoke("unwatch_file").catch(() => {});
          getCurrentWindow().setTitle("Eagle Markdown").catch(() => {});
        }
      }
      return next;
    });
  }, []);

  const switchTab = useCallback(async (id: string) => {
    setActiveTabId(id);
    const tab = tabsRef.current.find((t) => t.id === id);
    if (tab) {
      await getCurrentWindow().setTitle(`${tab.name} \u2014 Eagle Markdown`);
      await invoke("watch_file", { path: tab.path }).catch(() => {});
    }
  }, []);

  const handleOpen = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: "Markdown", extensions: ["md", "mdx", "markdown"] }],
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        for (const p of paths) await openFile(p as string);
      }
    } catch (err) {
      console.error("Failed to choose file:", err);
      showStatus("The file picker could not be opened.");
    }
  }, [openFile, showStatus]);

  // --- Event listeners ---

  // Native menu events (Cmd+O, Cmd+W)
  useEffect(() => {
    const u1 = listen("menu-open", () => handleOpen());
    const u2 = listen("menu-close-tab", () => {
      if (activeRef.current) {
        closeTab(activeRef.current);
      } else {
        getCurrentWindow().close();
      }
    });
    return () => {
      u1.then((fn) => fn());
      u2.then((fn) => fn());
    };
  }, [handleOpen, closeTab]);

  // File watcher (debounced)
  useEffect(() => {
    const unlisten = listen<string>("file-changed", (event) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(async () => {
        const changed = event.payload;
        try {
          const result = await invoke<FileData>("render_file", {
            path: changed,
          });
          setTabs((prev) =>
            prev.map((t) =>
              t.path === changed ? { ...t, html: result.html } : t,
            ),
          );
        } catch (err) {
          console.error("Failed to reload:", err);
          showStatus("Live reload paused because the file could not be read.");
        }
      }, 150);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Drag and drop
  useEffect(() => {
    const unlisten = getCurrentWindow().onDragDropEvent((event) => {
      if (
        event.payload.type === "enter" ||
        event.payload.type === "over"
      ) {
        setIsDragging(true);
      } else if (event.payload.type === "leave") {
        setIsDragging(false);
      } else if (event.payload.type === "drop") {
        setIsDragging(false);
        for (const p of event.payload.paths) {
          if (/\.(md|mdx|markdown)$/i.test(p)) openFile(p);
        }
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [openFile]);

  // CLI file argument
  useEffect(() => {
    invoke<string | null>("get_initial_file").then((path) => {
      if (path) openFile(path);
    });
  }, [openFile]);

  // --- Render ---

  return (
    <div className="app">
      <header className="app-chrome">
        <div className="brand-lockup" aria-label="Eagle Markdown">
          <img className="brand-mark" src={brandMark} alt="" aria-hidden="true" />
          <span className="brand-copy">
            <span className="brand-name">Eagle Markdown</span>
            <span className="brand-subtitle">
              {activeTab ? "Live preview" : "Native Markdown reader"}
            </span>
          </span>
        </div>

        <nav className="tab-bar" aria-label="Open Markdown files">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeTabId ? "tab-active" : ""}`}
              title={tab.path}
            >
              <button
                type="button"
                className="tab-button"
                onClick={() => switchTab(tab.id)}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    closeTab(tab.id);
                  }
                }}
                aria-current={tab.id === activeTabId ? "page" : undefined}
              >
                <span className="tab-name">{tab.name}</span>
              </button>
              <button
                type="button"
                className="tab-close"
                onClick={(e) => closeTab(tab.id, e)}
                aria-label={`Close ${tab.name}`}
              >
                &times;
              </button>
            </div>
          ))}
          <button
            type="button"
            className="tab-new"
            onClick={handleOpen}
            title="Open file (\u2318O)"
            aria-label="Open file"
          >
            +
          </button>
        </nav>

        <div className="reader-tools" aria-label="Reader controls">
          <div className="theme-switcher" aria-label="Theme">
            {THEME_OPTIONS.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={themeMode === theme.id ? "theme-active" : ""}
                onClick={() => setThemeMode(theme.id)}
                aria-pressed={themeMode === theme.id}
                title={`${theme.label} theme`}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main ref={mainRef} className="viewer-container" style={readerStyle}>
        {activeTab ? (
          <section className="reader-shell" aria-label={currentSpreadLabel}>
            <button
              type="button"
              className="page-nav page-nav-previous"
              onClick={turnPrevious}
              disabled={pageIndex === 0}
              aria-label="Previous page"
            >
              ‹
            </button>

            <div
              key={`${activeTab.id}-${pageIndex}`}
              ref={viewerRef}
              className={`book-spread ${
                visiblePageIndexes.length === 1 ? "book-spread-single" : ""
              } turn-${turnDirection}`}
            >
              {visiblePageIndexes.map((visibleIndex) => (
                <article
                  key={visibleIndex}
                  className="markdown-body book-page spread-page"
                  aria-label={`Page ${visibleIndex + 1}`}
                  dangerouslySetInnerHTML={{ __html: pages[visibleIndex] ?? "" }}
                />
              ))}
            </div>

            <button
              type="button"
              className="page-nav page-nav-next"
              onClick={turnNext}
              disabled={pageIndex >= lastPageIndex}
              aria-label="Next page"
            >
              ›
            </button>

            <div className="page-status" aria-live="polite">
              {currentSpreadLabel}
            </div>
          </section>
        ) : (
          <div className="empty-state">
            <div className="empty-book" aria-hidden="true">
              <svg
                width="112"
                height="112"
                viewBox="0 0 112 112"
                fill="none"
              >
                <path className="book-cover" d="M27 18h52a10 10 0 0 1 10 10v66H34a11 11 0 0 1-11-11V22a4 4 0 0 1 4-4Z" />
                <path className="book-page-line" d="M35 31h39M35 43h31M35 55h39M35 67h27" />
                <path className="book-page-curl" d="M76 94V72a8 8 0 0 1 8 8v14Z" />
              </svg>
            </div>
            <p className="empty-title">Open a Markdown file</p>
            <p className="empty-hint">
              Drop a .md file here, press <kbd>&#8984;O</kbd>, or choose{" "}
              <strong>File &gt; Open</strong>.
            </p>
          </div>
        )}
        {statusMessage && (
          <div className="status-toast" role="status" aria-live="polite">
            {statusMessage}
          </div>
        )}
        {isDragging && (
          <div className="drop-overlay">
            <div className="drop-box">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <p>Drop to open</p>
            </div>
          </div>
        )}
        <div
          ref={measurerRef}
          className="markdown-body book-page spread-page pagination-measurer"
          aria-hidden="true"
        />
      </main>
    </div>
  );
}

export default App;
