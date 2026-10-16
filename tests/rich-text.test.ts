import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { escapeMdText, mdInline, mdToHtml } from "@/lib/md";
import { blocksToMd, initialHtml, listValue } from "@/components/RichTextEditor";

/** Parse HTML the way a browser would hand it to the editor. */
const dom = (html: string) =>
  parseHTML(`<!doctype html><html><body>${html}</body></html>`).document.body as unknown as HTMLElement;

/** Load a stored markdown value into the editor and read it straight back. */
const edit = (md: string) => blocksToMd(dom(mdToHtml(md))).trim();

/** Text the supplier typed — browsers put typed characters into a text node. */
const typed = (text: string) =>
  blocksToMd(
    dom(`<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
  ).trim();

/** HTML arriving from a clipboard paste. */
const pasted = (html: string) => blocksToMd(dom(html)).trim();

describe("document rich text round trip", () => {
  it("keeps bold, italic and paragraphs stable", () => {
    const md = "Hello **world** and *italics*.\n\nSecond paragraph with a [link](https://example.com).";
    expect(edit(md)).toBe(md);
    expect(edit(edit(md))).toBe(md);
    expect(mdToHtml(edit(md))).toBe(mdToHtml(md));
  });

  it("keeps bullet and numbered lists stable", () => {
    const md = "- one\n- two **bold**\n\n1. first\n2. second";
    expect(edit(md)).toBe(md);
    expect(edit(edit(md))).toBe(md);
  });

  it("keeps headings, quotes and rules stable", () => {
    const md = "## Section\n\n> quoted line\n\n---\n\nAfter the rule.";
    expect(edit(md)).toBe(md);
    expect(mdToHtml(edit(md))).toBe(mdToHtml(md));
  });

  it("survives several edit cycles", () => {
    let md = "## Trip\n\n- **Pickup** at 08:00\n- Lunch included\n\n1. Meet the guide\n2. Rafting";
    for (let i = 0; i < 5; i++) md = edit(md);
    expect(md).toBe("## Trip\n\n- **Pickup** at 08:00\n- Lunch included\n\n1. Meet the guide\n2. Rafting");
  });
});

describe("literal text that looks like markdown", () => {
  it("renders typed asterisks literally", () => {
    const md = typed("5 * 3 = 15 and **not bold** typing");
    expect(md).toContain("\\*");
    const html = mdToHtml(md);
    expect(html).toContain("5 * 3 = 15");
    expect(html).toContain("**not bold**");
    expect(html).not.toContain("<strong>");
  });

  it("renders typed bullets and headings literally", () => {
    const md = typed("- not a bullet");
    const html = mdToHtml(md);
    expect(html).toContain("- not a bullet");
    expect(html).not.toContain("<li");

    const heading = typed("# not a heading");
    expect(mdToHtml(heading)).toContain("# not a heading");
    expect(mdToHtml(heading)).not.toContain("<h1");
  });

  it("keeps typed angle brackets as text", () => {
    const md = typed("<script>alert(1)</script>");
    const html = mdToHtml(md);
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("pasted html", () => {
  it("never emits a tag the clipboard supplied", () => {
    const md = pasted('before <img src="x" onerror="alert(1)"> after <script>alert(2)</script>');
    expect(md).not.toContain("<img");
    expect(md).not.toContain("<script");
    expect(md).not.toContain("onerror");
    const html = mdToHtml(md);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
  });

  it("drops styles, classes and attributes", () => {
    expect(pasted('<p style="color:red" class="x"><span style="font-size:40px">Big</span></p>')).toBe("Big");
    expect(pasted('<a href="https://example.com" target="_blank" style="color:blue">Click</a>')).toBe(
      "[Click](https://example.com)"
    );
  });

  it("keeps pasted formatting and structure", () => {
    const md = pasted("<h2>TITLE</h2><p>Intro</p><ul><li><b>One</b></li><li>Two</li></ul>");
    expect(md).toBe("## TITLE\n\nIntro\n\n- **One**\n- Two");
    expect(edit(md)).toBe(md);
  });
});

describe("list variant", () => {
  it("round trips one line per bullet", () => {
    const value = "Hotel pickup included\nSmall groups of 8 *max*";
    expect(listValue(dom(initialHtml(value, "list")))).toBe(value);
  });

  it("ignores legacy dash prefixes when loading", () => {
    expect(listValue(dom(initialHtml("- one\n- two", "list")))).toBe("one\ntwo");
  });

  it("serialises bold bullets written in the browser", () => {
    expect(listValue(dom("<ul><li><strong>Free</strong> cancellation</li><li>Second</li></ul>"))).toBe(
      "**Free** cancellation\nSecond"
    );
  });

  it("escapes markdown typed into a bullet", () => {
    expect(listValue(dom("<ul><li>5 * 3 = 15</li></ul>"))).toBe("5 \\* 3 = 15");
  });

  it("handles empty values", () => {
    expect(initialHtml("", "list")).toBe("");
    expect(initialHtml("   \n  ", "document")).toBe("");
    expect(listValue(dom(""))).toBe("");
  });
});

describe("md helpers", () => {
  it("escapeMdText is reversed by mdToHtml", () => {
    const text = "5 * 3 = 15 | [x] _y_ `z` ~t~";
    expect(mdToHtml(escapeMdText(text))).toBe(`<p>${text}</p>`);
  });

  it("mdInline renders formatting and escapes html", () => {
    expect(mdInline("**b** *i*")).toBe("<strong>b</strong> <em>i</em>");
    expect(mdInline("<script>alert(1)</script>")).not.toContain("<script");
  });
});
