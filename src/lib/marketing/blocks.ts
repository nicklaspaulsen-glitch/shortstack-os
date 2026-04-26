/**
 * Email block renderer for ShortStack Marketing.
 *
 * The campaign builder stores a campaign body as an array of typed blocks
 * (header, text, button, image, divider, footer, spacer). Server-side we
 * render those blocks to a self-contained HTML email with inline styles —
 * no external CSS required, gmail/outlook safe.
 *
 * v1 deliberately skips MJML for simplicity and faster TTFB on the cron
 * sender path. Upgrade to MJML in v2 for advanced layouts (multi-column,
 * responsive grids, etc.).
 *
 * Block schemas are loose by design (allow forward-compatible extra
 * fields) but typed enough that the wizard UI can produce them safely.
 */

export type EmailBlockType =
  | "header"
  | "text"
  | "button"
  | "image"
  | "divider"
  | "spacer"
  | "footer";

export interface EmailBlockBase {
  id: string;
  type: EmailBlockType;
}

export interface HeaderBlock extends EmailBlockBase {
  type: "header";
  text: string;
  align?: "left" | "center" | "right";
  size?: "sm" | "md" | "lg";
  color?: string;
}

export interface TextBlock extends EmailBlockBase {
  type: "text";
  text: string;
  align?: "left" | "center" | "right";
  color?: string;
}

export interface ButtonBlock extends EmailBlockBase {
  type: "button";
  text: string;
  url: string;
  align?: "left" | "center" | "right";
  background?: string;
  color?: string;
}

export interface ImageBlock extends EmailBlockBase {
  type: "image";
  src: string;
  alt?: string;
  width?: number;
  href?: string;
  align?: "left" | "center" | "right";
}

export interface DividerBlock extends EmailBlockBase {
  type: "divider";
  color?: string;
}

export interface SpacerBlock extends EmailBlockBase {
  type: "spacer";
  height?: number;
}

export interface FooterBlock extends EmailBlockBase {
  type: "footer";
  companyName?: string;
  address?: string;
  unsubscribeUrl?: string;
}

export type EmailBlock =
  | HeaderBlock
  | TextBlock
  | ButtonBlock
  | ImageBlock
  | DividerBlock
  | SpacerBlock
  | FooterBlock;

const DEFAULT_TEXT_COLOR = "#1a1611";
const DEFAULT_BG = "#ffffff";
const DEFAULT_ACCENT = "#C9A84C";
const DEFAULT_MUTED = "#6b6b6b";

const HEADER_SIZE_PX: Record<NonNullable<HeaderBlock["size"]>, number> = {
  sm: 20,
  md: 26,
  lg: 32,
};

function escapeHtml(input: string | undefined | null): string {
  if (!input) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(input: string | undefined | null): string {
  if (!input) return "";
  return String(input).replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function safeUrl(raw: string | undefined | null): string {
  if (!raw || typeof raw !== "string") return "#";
  const trimmed = raw.trim();
  if (!trimmed) return "#";
  if (/^(https?:|mailto:|tel:|\/)/i.test(trimmed)) return escapeAttr(trimmed);
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}/i.test(trimmed)) {
    return `https://${escapeAttr(trimmed)}`;
  }
  return "#";
}

function alignToStyle(align: "left" | "center" | "right" | undefined): string {
  return `text-align: ${align === "center" ? "center" : align === "right" ? "right" : "left"};`;
}

function renderHeader(block: HeaderBlock): string {
  const size = HEADER_SIZE_PX[block.size ?? "md"];
  const color = block.color || DEFAULT_TEXT_COLOR;
  return `<tr><td style="padding: 16px 24px; ${alignToStyle(block.align)}">
    <h2 style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: ${size}px; line-height: 1.2; color: ${escapeAttr(color)}; font-weight: 700;">${escapeHtml(block.text)}</h2>
  </td></tr>`;
}

function renderText(block: TextBlock): string {
  const color = block.color || DEFAULT_TEXT_COLOR;
  const escaped = escapeHtml(block.text).replace(/\n/g, "<br>");
  return `<tr><td style="padding: 8px 24px; ${alignToStyle(block.align)}">
    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: ${escapeAttr(color)};">${escaped}</p>
  </td></tr>`;
}

function renderButton(block: ButtonBlock): string {
  const bg = block.background || DEFAULT_ACCENT;
  const color = block.color || "#1a1611";
  const align = block.align || "center";
  return `<tr><td style="padding: 16px 24px; ${alignToStyle(align)}">
    <a href="${safeUrl(block.url)}" style="display: inline-block; padding: 14px 28px; background-color: ${escapeAttr(bg)}; color: ${escapeAttr(color)}; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 600; border-radius: 8px;">${escapeHtml(block.text)}</a>
  </td></tr>`;
}

function renderImage(block: ImageBlock): string {
  const align = block.align || "center";
  const widthAttr = block.width ? `width="${Math.max(1, Math.min(800, Math.floor(block.width)))}"` : "";
  const widthStyle = block.width
    ? `max-width: ${Math.max(1, Math.min(800, Math.floor(block.width)))}px;`
    : "max-width: 100%;";
  const img = `<img src="${safeUrl(block.src)}" alt="${escapeAttr(block.alt || "")}" ${widthAttr} style="display: block; ${widthStyle} height: auto; border: 0; outline: none;">`;
  const wrapped = block.href ? `<a href="${safeUrl(block.href)}" style="text-decoration: none;">${img}</a>` : img;
  return `<tr><td style="padding: 8px 24px; ${alignToStyle(align)}">${wrapped}</td></tr>`;
}

function renderDivider(block: DividerBlock): string {
  const color = block.color || "#e5e5e5";
  return `<tr><td style="padding: 16px 24px;">
    <div style="border-top: 1px solid ${escapeAttr(color)}; line-height: 0; font-size: 0;">&nbsp;</div>
  </td></tr>`;
}

function renderSpacer(block: SpacerBlock): string {
  const h = Math.max(4, Math.min(120, Number.isFinite(block.height) ? Number(block.height) : 24));
  return `<tr><td style="height: ${h}px; line-height: ${h}px; font-size: 0;">&nbsp;</td></tr>`;
}

function renderFooter(block: FooterBlock): string {
  const company = escapeHtml(block.companyName || "ShortStack");
  const address = escapeHtml(block.address || "");
  const unsub = block.unsubscribeUrl ? `<br><a href="${safeUrl(block.unsubscribeUrl)}" style="color: ${DEFAULT_MUTED}; text-decoration: underline;">Unsubscribe</a>` : "";
  return `<tr><td style="padding: 24px; text-align: center; background-color: #f7f7f7;">
    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.6; color: ${DEFAULT_MUTED};">${company}${address ? `<br>${address}` : ""}${unsub}</p>
  </td></tr>`;
}

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case "header":
      return renderHeader(block);
    case "text":
      return renderText(block);
    case "button":
      return renderButton(block);
    case "image":
      return renderImage(block);
    case "divider":
      return renderDivider(block);
    case "spacer":
      return renderSpacer(block);
    case "footer":
      return renderFooter(block);
    default:
      return "";
  }
}

export interface RenderEmailOptions {
  blocks: EmailBlock[];
  preheader?: string;
  subject?: string;
}

export function renderEmailHtml(opts: RenderEmailOptions): string {
  const blocks = Array.isArray(opts.blocks) ? opts.blocks : [];
  const rows = blocks.map(renderBlock).join("\n");
  const subject = escapeHtml(opts.subject || "");
  const preheader = escapeHtml(opts.preheader || "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f0;">
<span style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0f0f0;">
  <tr><td align="center" style="padding: 24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: ${DEFAULT_BG}; border-radius: 12px; overflow: hidden;">
${rows}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function coerceBlocks(raw: unknown): EmailBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: EmailBlock[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.type !== "string") continue;
    if (typeof e.id !== "string") continue;
    out.push(entry as EmailBlock);
  }
  return out;
}
