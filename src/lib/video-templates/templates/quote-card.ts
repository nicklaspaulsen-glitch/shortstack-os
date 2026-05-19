/**
 * "Quote Card" template — elegant full-screen quote display, 9:16 TikTok format.
 *
 * Layers:
 *   1. Dark textured background with subtle radial glow
 *   2. Opening quotation mark — fades in at 0.2s (decorative, large)
 *   3. Quote text — fades + slides up at 0.6s
 *   4. Attribution line — fades in at 1.4s
 *   5. Thin accent rule above attribution — scales in at 1.2s
 *   6. Optional bottom tag/CTA — fades in at 2.0s
 *   7. Subtle noise grain
 *
 * Total duration: 5 seconds
 */

export interface QuoteCardProps {
  quote: string;
  attribution?: string;         // e.g. "— Steve Jobs" or "Confucius"
  tag?: string;                 // bottom tag, e.g. "#motivation" or "Daily Wisdom"
  bgColor?: string;             // e.g. "#020711"
  accentColor?: string;         // e.g. "#3B82F6" — rule + quote mark tint
  textColor?: string;           // e.g. "#F0F0F4"
  fontFamily?: string;
  quoteSize?: "sm" | "md" | "lg"; // controls quote font size (default "md")
}

export function renderQuoteCard(props: QuoteCardProps): string {
  const {
    quote,
    attribution = "",
    tag = "",
    bgColor = "#020711",
    accentColor = "#3B82F6",
    textColor = "#F0F0F4",
    fontFamily = "Georgia, 'Times New Roman', serif",
    quoteSize = "md",
  } = props;

  // Font size by tier
  const quoteFontSizes = { sm: "52px", md: "64px", lg: "80px" };
  const quoteFontSize = quoteFontSizes[quoteSize] ?? quoteFontSizes.md;

  // Escape HTML special chars
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<title>Quote Card</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1080px;height:1920px;overflow:hidden;background:${esc(bgColor)};font-family:${esc(fontFamily)}}

  /* Noise grain */
  .grain{position:fixed;inset:0;pointer-events:none;opacity:0.04;z-index:100;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
    background-size:200px 200px;mix-blend-mode:overlay}

  /* Radial ambient glow — centred, accent-tinted */
  .bg-glow{position:absolute;inset:0;z-index:0;
    background:radial-gradient(ellipse 90% 70% at 50% 45%,${esc(accentColor)}14 0%,transparent 65%)}

  /* Outer frame lines (top + bottom thin accent) */
  .frame-top,.frame-bottom{position:absolute;left:80px;right:80px;height:1px;
    background:${esc(accentColor)};opacity:0.18;z-index:1}
  .frame-top{top:120px;animation:frameFade 0.8s ease 0.1s both}
  .frame-bottom{bottom:120px;animation:frameFade 0.8s ease 0.15s both}
  @keyframes frameFade{from{opacity:0;transform:scaleX(0)}to{opacity:0.18;transform:scaleX(1)}}

  /* Giant decorative quotation mark */
  .quote-mark{position:absolute;left:72px;top:200px;z-index:1;
    font-size:320px;font-weight:900;line-height:0.8;
    color:${esc(accentColor)};opacity:0.12;
    font-family:Georgia,serif;letter-spacing:-0.05em;
    animation:markIn 0.7s ease-out 0.2s both;user-select:none}
  @keyframes markIn{from{opacity:0;transform:translateY(20px)}to{opacity:0.12;transform:none}}

  /* Quote text */
  .quote{position:absolute;left:100px;right:100px;top:50%;transform:translateY(-50%);z-index:2;
    font-size:${quoteFontSize};font-weight:400;line-height:1.45;letter-spacing:-0.01em;
    color:${esc(textColor)};font-style:italic;
    animation:quoteIn 0.8s cubic-bezier(0.16,1,0.3,1) 0.6s both}
  @keyframes quoteIn{from{opacity:0;transform:translateY(30px) translateY(-50%)}to{opacity:1;transform:translateY(-50%)}}

  /* Accent rule above attribution */
  .rule{position:absolute;left:100px;bottom:280px;z-index:2;
    width:56px;height:2px;border-radius:1px;background:${esc(accentColor)};
    animation:ruleIn 0.5s cubic-bezier(0.16,1,0.3,1) 1.2s both;transform-origin:left}
  @keyframes ruleIn{from{transform:scaleX(0)}to{transform:scaleX(1)}}

  /* Attribution */
  .attribution{position:absolute;left:100px;bottom:196px;right:100px;z-index:2;
    font-size:32px;font-weight:400;font-style:normal;letter-spacing:0.02em;
    color:rgba(240,240,244,0.55);
    animation:fadeUp 0.6s ease-out 1.4s both}
  @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}

  /* Tag / CTA */
  .tag{position:absolute;left:100px;bottom:140px;z-index:2;
    font-size:26px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;
    font-family:Inter,-apple-system,sans-serif;font-style:normal;
    color:${esc(accentColor)};opacity:0.7;
    animation:fadeUp 0.6s ease-out 2.0s both}
</style>
</head>
<body>
  <div class="bg-glow"></div>
  <div class="grain"></div>
  <div class="frame-top"></div>
  <div class="frame-bottom"></div>
  <div class="quote-mark">"</div>
  <div class="quote">${esc(quote)}</div>
  ${attribution ? `<div class="rule"></div><div class="attribution">${esc(attribution)}</div>` : ""}
  ${tag ? `<div class="tag">${esc(tag)}</div>` : ""}
</body>
</html>`;
}

export const quoteCardTemplate = {
  id: "quote-card",
  name: "Quote Card",
  description: "Elegant full-screen quote display with serif typography — great for inspiration and thought leadership.",
  category: "text",
  aspectRatio: "9:16" as const,
  durationSeconds: 5,
  previewGradient: "linear-gradient(135deg, #020711 0%, #0D1120 50%, #3B82F614 100%)",
  defaultProps: {
    quote: "The best way to predict the future is to create it.",
    attribution: "— Peter Drucker",
    tag: "#leadership",
    bgColor: "#020711",
    accentColor: "#3B82F6",
    textColor: "#F0F0F4",
    quoteSize: "md" as const,
  } satisfies QuoteCardProps,
  render: renderQuoteCard,
};
