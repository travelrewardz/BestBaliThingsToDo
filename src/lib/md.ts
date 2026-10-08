/**
 * Small, dependency-free markdown renderer for CMS content.
 * Escapes all input HTML first (XSS-safe), then applies formatting:
 * headings, bold/italic, links, images, ul/ol, tables, blockquotes,
 * fenced code, horizontal rules, paragraphs.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s: string): string {
  let out = s;
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, src) => {
    const safe = String(src).startsWith("/") || /^https?:\/\//i.test(src) ? src : "#";
    return `<img src="${escapeHtml(safe)}" alt="${escapeHtml(alt)}" loading="lazy" />`;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, href) => {
    const safe = String(href).startsWith("/") || /^https?:\/\//i.test(href) ? href : "#";
    const ext = /^https?:\/\//i.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${escapeHtml(safe)}"${ext}>${text}</a>`;
  });
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return out;
}

export function mdToHtml(md: string): string {
  if (!md) return "";
  const lines = escapeHtml(md).split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  let list: "ul" | "ol" | null = null;
  let inCode = false;
  let codeBuf: string[] = [];
  let para: string[] = [];

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCode) {
        out.push(`<pre><code>${codeBuf.join("\n")}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        flushPara();
        closeList();
        inCode = true;
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }

    // table
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])
    ) {
      flushPara();
      closeList();
      const headers = line.split("|").map((c) => c.trim()).filter(Boolean);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(lines[i].split("|").map((c) => c.trim()).filter(Boolean));
        i++;
      }
      out.push(
        `<table><thead><tr>${headers
          .map((h) => `<th>${inline(h)}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`
      );
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      closeList();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      flushPara();
      closeList();
      out.push("<hr />");
      i++;
      continue;
    }

    if (line.startsWith("&gt; ")) {
      flushPara();
      closeList();
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith("&gt; ")) {
        quote.push(lines[i].slice(5));
        i++;
      }
      out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      continue;
    }

    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      const kind = ul ? "ul" : "ol";
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((ul || ol)![1])}</li>`);
      i++;
      continue;
    }

    if (line.trim() === "") {
      flushPara();
      closeList();
      i++;
      continue;
    }

    para.push(line.trim());
    i++;
  }
  if (inCode) out.push(`<pre><code>${codeBuf.join("\n")}</code></pre>`);
  flushPara();
  closeList();
  return out.join("\n");
}

/** Plain text excerpt for meta descriptions / cards. */
export function mdToText(md: string, maxLen = 200): string {
  const text = (md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).replace(/\s+\S*$/, "") + "…";
}

/** FAQ block extractor: lines starting with "Q:" / "A:". */
export function parseFaqJson(json: string | null | undefined): { q: string; a: string }[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({ q: String(x?.q ?? ""), a: String(x?.a ?? "") }))
      .filter((x) => x.q && x.a);
  } catch {
    return [];
  }
}

export function parseStringArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}
