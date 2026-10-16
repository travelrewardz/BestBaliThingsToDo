"use client";

import { useEffect, useRef, useState } from "react";
import { escapeMdText, mdInline, mdToHtml } from "@/lib/md";

/**
 * Dependency-free rich text editor.
 *
 * The value is markdown (the same format the public site already renders with
 * `mdToHtml`), so no database changes are needed and pasted HTML can never end
 * up on the page — everything is serialised back to markdown on every keystroke.
 *
 * - `variant="document"` → paragraphs, headings, lists, quotes (Important note, itinerary)
 * - `variant="list"`      → one markdown line per bullet (Highlights)
 */

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

const BLOCK_CONTAINERS = new Set([
  "DIV",
  "P",
  "SECTION",
  "ARTICLE",
  "MAIN",
  "HEADER",
  "FOOTER",
  "FIGURE",
  "FIGCAPTION",
  "ADDRESS",
  "DL",
  "DT",
  "DD",
]);

/** Inline children of a node → markdown (text is escaped, tags are whitelisted). */
function inlineMd(nodes: Iterable<ChildNode>): string {
  let out = "";
  for (const node of nodes) {
    if (node.nodeType === TEXT_NODE) {
      out += escapeMdText(node.nodeValue ?? "");
      continue;
    }
    if (node.nodeType !== ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    switch (el.tagName) {
      case "BR":
        out += "\n";
        break;
      case "STRONG":
      case "B": {
        const inner = inlineMd(el.childNodes).trim();
        if (inner) out += `**${inner}**`;
        break;
      }
      case "EM":
      case "I": {
        const inner = inlineMd(el.childNodes).trim();
        if (inner) out += `*${inner}*`;
        break;
      }
      case "DEL":
      case "S":
      case "STRIKE": {
        const inner = inlineMd(el.childNodes).trim();
        if (inner) out += `~~${inner}~~`;
        break;
      }
      case "A": {
        const href = el.getAttribute("href") ?? "";
        const inner = inlineMd(el.childNodes).trim();
        const safe = href.startsWith("/") || /^https?:\/\//i.test(href);
        out += inner ? (safe ? `[${inner}](${href})` : inner) : "";
        break;
      }
      case "CODE": {
        const inner = (el.textContent ?? "").replace(/\n/g, " ").trim();
        if (inner) out += `\`${inner}\``;
        break;
      }
      case "UL":
      case "OL": {
        const items = Array.from(el.children)
          .filter((li) => li.tagName === "LI")
          .map((li) => inlineMd(li.childNodes).replace(/\s*\n\s*/g, " ").trim())
          .filter(Boolean);
        if (items.length) out += items.join("; ");
        break;
      }
      default:
        // Unknown inline wrappers (span, u, font, …) → keep their children only.
        out += inlineMd(el.childNodes);
    }
  }
  return out;
}

/** One markdown line per <li>. */
function listItems(list: HTMLElement): string[] {
  return Array.from(list.children)
    .filter((child) => child.tagName === "LI")
    .map((li) => inlineMd(li.childNodes).replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/** Block-level children of a node → markdown. */
export function blocksToMd(root: HTMLElement): string {
  const out: string[] = [];
  let buf: ChildNode[] = [];
  const flush = () => {
    if (buf.length) {
      out.push(inlineMd(buf).replace(/\n{3,}/g, "\n\n") + "\n\n");
      buf = [];
    }
  };

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName;

      if (tag === "UL" || tag === "OL") {
        flush();
        const items = listItems(el);
        if (items.length) {
          out.push(
            items
              .map((text, i) => (tag === "OL" ? `${i + 1}. ` : "- ") + text)
              .join("\n") + "\n\n"
          );
        }
        continue;
      }
      if (/^H[1-6]$/.test(tag)) {
        flush();
        const text = inlineMd(el.childNodes).trim();
        if (text) out.push("#".repeat(Number(tag[1])) + " " + text + "\n\n");
        continue;
      }
      if (tag === "HR") {
        flush();
        out.push("---\n\n");
        continue;
      }
      if (tag === "BLOCKQUOTE") {
        flush();
        const inner = blocksToMd(el).trim();
        if (inner) out.push(inner.split("\n").map((l) => `> ${l}`).join("\n") + "\n\n");
        continue;
      }
      if (tag === "PRE") {
        flush();
        const code = (el.textContent ?? "").replace(/\n+$/, "");
        if (code) out.push("```\n" + code + "\n```\n\n");
        continue;
      }
      if (tag === "TABLE") {
        flush();
        const rows = Array.from(el.querySelectorAll("tr")).map((tr) =>
          Array.from(tr.children)
            .filter((cell) => cell.tagName === "TH" || cell.tagName === "TD")
            .map((cell) => inlineMd(cell.childNodes).replace(/\|/g, " / ").trim())
        );
        if (rows.length) {
          const [head, ...body] = rows;
          const table = [
            `| ${head.join(" | ")} |`,
            `| ${head.map(() => "---").join(" | ")} |`,
            ...body.map((r) => `| ${r.join(" | ")} |`),
          ];
          out.push(table.join("\n") + "\n\n");
        }
        continue;
      }
      if (BLOCK_CONTAINERS.has(tag)) {
        flush();
        out.push(blocksToMd(el) || "\n\n");
        continue;
      }
    }
    // Inline leftovers (text, spans, strong, links, <br>, …) become a paragraph.
    buf.push(node);
  }
  flush();
  return out.join("").replace(/\n{3,}/g, "\n\n");
}

/** The whole editor (list variant) → one markdown line per bullet. */
export function listValue(root: HTMLElement): string {
  const lines: string[] = [];
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName;
      if (tag === "UL" || tag === "OL") {
        lines.push(...listItems(el));
        continue;
      }
      if (tag === "BR") continue;
      if (BLOCK_CONTAINERS.has(tag)) {
        lines.push(...listValue(el).split("\n"));
        continue;
      }
      const text = inlineMd([node]).replace(/\s*\n\s*/g, " ").trim();
      if (text) lines.push(text);
      continue;
    }
    if (node.nodeName === "BR") continue;
    const text = inlineMd([node]).replace(/\s*\n\s*/g, " ").trim();
    if (text) lines.push(text);
  }
  return lines.filter((l) => l.trim()).join("\n");
}

/** Initial innerHTML for a markdown value (exported for tests). */
export function initialHtml(value: string, variant: "document" | "list"): string {
  if (!value.trim()) return "";
  if (variant === "document") return mdToHtml(value);
  const items = value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .filter(Boolean);
  if (!items.length) return "";
  return `<ul>${items.map((item) => `<li>${mdInline(item)}</li>`).join("")}</ul>`;
}

/** Clipboard HTML → markdown (pasted markup is parsed, never inserted raw). */
function pastedHtmlToMd(html: string, variant: "document" | "list"): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const body = doc.body;
    if (!body) return "";
    return variant === "list" ? listValue(body) : blocksToMd(body).trim();
  } catch {
    return "";
  }
}

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClass?: string;
  variant?: "document" | "list";
};

const toolbarBtn =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40";
const activeCls = "border-brand-300 bg-brand-50 text-brand-700";

export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  minHeightClass = "min-h-32",
  variant = "document",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string | null>(null);
  const [empty, setEmpty] = useState(!value.trim());
  const [active, setActive] = useState({ bold: false, italic: false, ul: false, ol: false });

  // Keep the DOM in sync when the value changes from the outside (load, reset, row reorder).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    el.innerHTML = initialHtml(value, variant);
    setEmpty(!value.trim());
  }, [value, variant]);

  const syncActive = () => {
    const el = ref.current;
    if (!el || document.activeElement !== el) return;
    try {
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        ul: document.queryCommandState("insertUnorderedList"),
        ol: document.queryCommandState("insertOrderedList"),
      });
    } catch {
      /* queryCommandState is unsupported in a few browsers — styling only. */
    }
  };

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const md = variant === "list" ? listValue(el) : blocksToMd(el).trim();
    lastEmitted.current = md;
    setEmpty(!md.trim());
    onChange(md);
  };

  const run = (command: string, arg?: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, arg);
    emit();
    syncActive();
  };

  const addLink = () => {
    const el = ref.current;
    if (!el) return;
    const url = window.prompt("Link URL", "https://");
    if (!url) return;
    if (!url.startsWith("/") && !/^https?:\/\//i.test(url)) {
      window.alert("Links must start with https:// or /");
      return;
    }
    el.focus();
    document.execCommand("createLink", false, url);
    emit();
    syncActive();
  };

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const data = event.clipboardData;
    const html = data.getData("text/html");
    if (html) {
      const md = pastedHtmlToMd(html, variant);
      if (md.trim()) {
        document.execCommand("insertHTML", false, initialHtml(md, variant));
        emit();
        return;
      }
    }
    document.execCommand("insertText", false, data.getData("text/plain"));
    emit();
  };

  /** Keep the caret where it is when a toolbar button is clicked. */
  const keepSelection = (e: React.MouseEvent) => e.preventDefault();
  const cls = (...extra: string[]) => [toolbarBtn, ...extra].filter(Boolean).join(" ");

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
        <button type="button" title="Bold" aria-label="Bold" onMouseDown={keepSelection} onClick={() => run("bold")} className={cls("font-extrabold")}>
          B
        </button>
        <button type="button" title="Italic" aria-label="Italic" onMouseDown={keepSelection} onClick={() => run("italic")} className={cls("font-serif italic")}>
          I
        </button>
        <button
          type="button"
          title="Bulleted list"
          aria-label="Bulleted list"
          onMouseDown={keepSelection}
          onClick={() => run("insertUnorderedList")}
          className={cls(active.ul ? activeCls : "")}
        >
          •
        </button>
        <button
          type="button"
          title="Numbered list"
          aria-label="Numbered list"
          onMouseDown={keepSelection}
          onClick={() => run("insertOrderedList")}
          className={cls(active.ol ? activeCls : "")}
        >
          1.
        </button>
        <button type="button" title="Insert link" aria-label="Insert link" onMouseDown={keepSelection} onClick={addLink} className={cls()}>
          Link
        </button>
        <button
          type="button"
          title="Clear formatting"
          aria-label="Clear formatting"
          onMouseDown={keepSelection}
          onClick={() => run("removeFormat")}
          className={cls("font-normal")}
        >
          Tx
        </button>
        <span className="ml-auto hidden pr-1 text-[11px] font-medium text-slate-400 sm:block">
          {active.bold ? "Bold " : ""}
          {active.italic ? "Italic " : ""}
        </span>
      </div>

      <div className="relative">
        {empty && (
          <span className="pointer-events-none absolute left-3.5 top-2.5 text-sm text-slate-400">
            {placeholder}
          </span>
        )}
        <div
          ref={ref}
          id={id}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          data-testid={id}
          spellCheck
          suppressContentEditableWarning
          onInput={emit}
          onKeyUp={syncActive}
          onMouseUp={syncActive}
          onFocus={syncActive}
          onBlur={() => setActive({ bold: false, italic: false, ul: false, ol: false })}
          onPaste={onPaste}
          className={`prose-bali px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none ${minHeightClass}`}
        />
      </div>
    </div>
  );
}
