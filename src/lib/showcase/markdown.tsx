// Minimal safe-markdown renderer used by showcase pages and the editor preview.
// Not a full CommonMark — supports the subset the AI auto-drafter produces:
// headings (#, ##, ###), bold/italic, inline code, links, bullet + numbered
// lists, blockquotes, horizontal rules, and paragraphs. Input is always
// HTML-escaped first so raw HTML in the markdown source is rendered literally.
//
// The spec asks for react-markdown@^10 but it's not actually in deps, so this
// zero-dep renderer avoids a new dep while covering the fields we populate.

import React from "react";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(raw: string): string {
  let s = escapeHtml(raw);
  // inline code
  s = s.replace(/`([^`]+?)`/g, '<code class="px-1 py-0.5 rounded bg-white/10 text-[0.9em]">$1</code>');
  // bold
  s = s.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+?)__/g, "<strong>$1</strong>");
  // italic
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_])_([^_\n]+?)_/g, "$1<em>$2</em>");
  // links — [text](url). Only allow http(s) or mailto.
  s = s.replace(/\[([^\]]+?)\]\(([^)\s]+?)\)/g, (_m, text, href) => {
    if (!/^(https?:|mailto:|\/)/.test(href)) return text;
    const safeHref = href.replace(/"/g, "&quot;");
    return `<a href="${safeHref}" class="underline hover:text-white" rel="noopener noreferrer" target="_blank">${text}</a>`;
  });
  return s;
}

interface Block {
  kind: "h1" | "h2" | "h3" | "p" | "ul" | "ol" | "quote" | "hr";
  lines: string[];
}

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let buf: string[] = [];

  const flushPara = () => {
    if (buf.length) {
      out.push({ kind: "p", lines: [buf.join(" ")] });
      buf = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushPara();
      continue;
    }
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      flushPara();
      out.push({ kind: "hr", lines: [] });
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      flushPara();
      const level = h[1].length as 1 | 2 | 3;
      out.push({ kind: level === 1 ? "h1" : level === 2 ? "h2" : "h3", lines: [h[2]] });
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      flushPara();
      const qlines: string[] = [trimmed.replace(/^>\s?/, "")];
      while (i + 1 < lines.length && /^>\s?/.test(lines[i + 1].trim())) {
        i += 1;
        qlines.push(lines[i].trim().replace(/^>\s?/, ""));
      }
      out.push({ kind: "quote", lines: qlines });
      continue;
    }
    if (/^[-*+]\s+/.test(trimmed)) {
      flushPara();
      const items: string[] = [trimmed.replace(/^[-*+]\s+/, "")];
      while (i + 1 < lines.length && /^[-*+]\s+/.test(lines[i + 1].trim())) {
        i += 1;
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ""));
      }
      out.push({ kind: "ul", lines: items });
      continue;
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      flushPara();
      const items: string[] = [trimmed.replace(/^\d+\.\s+/, "")];
      while (i + 1 < lines.length && /^\d+\.\s+/.test(lines[i + 1].trim())) {
        i += 1;
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
      }
      out.push({ kind: "ol", lines: items });
      continue;
    }

    buf.push(trimmed);
  }
  flushPara();
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseBlocks(source || "");
  return (
    <div className={className}>
      {blocks.map((b, idx) => {
        switch (b.kind) {
          case "h1":
            return (
              <h1
                key={idx}
                className="text-3xl md:text-4xl font-bold mt-8 mb-4"
                dangerouslySetInnerHTML={{ __html: renderInline(b.lines[0]) }}
              />
            );
          case "h2":
            return (
              <h2
                key={idx}
                className="text-2xl md:text-3xl font-bold mt-8 mb-3"
                dangerouslySetInnerHTML={{ __html: renderInline(b.lines[0]) }}
              />
            );
          case "h3":
            return (
              <h3
                key={idx}
                className="text-xl md:text-2xl font-semibold mt-6 mb-2"
                dangerouslySetInnerHTML={{ __html: renderInline(b.lines[0]) }}
              />
            );
          case "ul":
            return (
              <ul key={idx} className="list-disc pl-6 my-3 space-y-1">
                {b.lines.map((li, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(li) }} />
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={idx} className="list-decimal pl-6 my-3 space-y-1">
                {b.lines.map((li, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(li) }} />
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={idx}
                className="border-l-2 border-white/20 pl-4 my-4 italic text-white/80"
                dangerouslySetInnerHTML={{ __html: renderInline(b.lines.join(" ")) }}
              />
            );
          case "hr":
            return <hr key={idx} className="my-6 border-white/10" />;
          case "p":
          default:
            return (
              <p
                key={idx}
                className="my-3 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderInline(b.lines[0]) }}
              />
            );
        }
      })}
    </div>
  );
}

export default Markdown;
