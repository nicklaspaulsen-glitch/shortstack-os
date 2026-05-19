/**
 * "Listicle" template — numbered list items reveal sequentially, 9:16 TikTok format.
 *
 * Layers:
 *   1. Gradient background (dark base → accent tint)
 *   2. Title — slides down from top at 0.3s
 *   3. Numbered items — stagger in at 0.8s intervals (item 1 at 0.8s, item 2 at 1.6s, …)
 *   4. Each item: number badge + text, slides from left
 *   5. Bottom CTA line — fades in after last item
 *   6. Subtle noise grain
 *
 * Total duration: 6 seconds (accommodates up to 5 items)
 */

export interface ListicleProps {
  title: string;
  items: string[];            // 2–5 items recommended
  cta?: string;
  bgColor?: string;           // e.g. "#020711"
  accentColor?: string;       // e.g. "#D4FF00" — used for number badges
  textColor?: string;         // e.g. "#F0F0F4"
  fontFamily?: string;
}

export function renderListicle(props: ListicleProps): string {
  const {
    title,
    items,
    cta = "",
    bgColor = "#020711",
    accentColor = "#D4FF00",
    textColor = "#F0F0F4",
    fontFamily = "Inter, -apple-system, sans-serif",
  } = props;

  // Clamp to 5 items max
  const displayItems = items.slice(0, 5);

  // Escape HTML special chars
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Per-item animation delay (0.8s per item starting at 0.8s)
  const itemAnimations = displayItems
    .map((item, i) => {
      const delay = 0.8 + i * 0.8;
      return `
  .item-${i} {
    animation:itemIn 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s both
  }`;
    })
    .join("");

  // Last item's delay + 0.8s for CTA reveal
  const ctaDelay = 0.8 + displayItems.length * 0.8;

  const itemsHtml = displayItems
    .map(
      (item, i) => `
  <div class="item item-${i}">
    <div class="item-badge">${i + 1}</div>
    <div class="item-text">${esc(item)}</div>
  </div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<title>Listicle</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1080px;height:1920px;overflow:hidden;background:${esc(bgColor)};font-family:${esc(fontFamily)}}

  /* Noise grain */
  .grain{position:fixed;inset:0;pointer-events:none;opacity:0.03;z-index:100;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
    background-size:200px 200px;mix-blend-mode:overlay}

  /* Gradient background */
  .bg{position:absolute;inset:0;z-index:0;
    background:radial-gradient(ellipse 120% 60% at 50% 100%,${esc(accentColor)}18 0%,transparent 70%),
               linear-gradient(180deg,${esc(bgColor)} 0%,${esc(bgColor)} 100%)}

  /* Title */
  .title{position:absolute;left:80px;right:80px;top:160px;z-index:2;
    font-size:72px;font-weight:800;line-height:1.05;letter-spacing:-0.025em;
    color:${esc(textColor)};
    animation:titleIn 0.7s cubic-bezier(0.16,1,0.3,1) 0.3s both}
  @keyframes titleIn{from{opacity:0;transform:translateY(-30px)}to{opacity:1;transform:none}}

  /* Title accent underline */
  .title-underline{display:block;width:56px;height:4px;border-radius:2px;
    background:${esc(accentColor)};margin-top:20px;
    animation:lineIn 0.5s cubic-bezier(0.16,1,0.3,1) 0.55s both;transform-origin:left}
  @keyframes lineIn{from{transform:scaleX(0)}to{transform:scaleX(1)}}

  /* Items container */
  .items{position:absolute;left:80px;right:80px;top:440px;z-index:2;display:flex;flex-direction:column;gap:48px}

  /* Individual item */
  .item{display:flex;align-items:flex-start;gap:36px;
    animation:itemIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.8s both}
  @keyframes itemIn{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}

  /* Number badge */
  .item-badge{flex-shrink:0;width:72px;height:72px;border-radius:16px;
    background:${esc(accentColor)};display:flex;align-items:center;justify-content:center;
    font-size:36px;font-weight:900;color:${esc(bgColor)};letter-spacing:-0.02em;margin-top:4px}

  /* Item text */
  .item-text{font-size:48px;font-weight:500;line-height:1.25;letter-spacing:-0.015em;
    color:${esc(textColor)};padding-top:8px}

  /* CTA */
  .cta{position:absolute;left:80px;bottom:140px;z-index:2;
    font-size:30px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;
    color:${esc(accentColor)};opacity:0.8;
    animation:fadeIn 0.6s ease-out ${ctaDelay}s both}
  @keyframes fadeIn{from{opacity:0}to{opacity:0.8}}

  /* Per-item stagger overrides */
  ${itemAnimations}
</style>
</head>
<body>
  <div class="bg"></div>
  <div class="grain"></div>
  <div class="title">${esc(title)}<span class="title-underline"></span></div>
  <div class="items">${itemsHtml}
  </div>
  ${cta ? `<div class="cta">${esc(cta)}</div>` : ""}
</body>
</html>`;
}

export const listicleTemplate = {
  id: "listicle",
  name: "Listicle",
  description: "Numbered list items reveal sequentially — perfect for tips, steps, and countdowns.",
  category: "text",
  aspectRatio: "9:16" as const,
  durationSeconds: 6,
  previewGradient: "linear-gradient(135deg, #020711 0%, #0D1120 70%, #D4FF0015 100%)",
  defaultProps: {
    title: "5 things you need to know",
    items: [
      "Start with the fundamentals",
      "Build consistent habits",
      "Track your progress daily",
      "Find your community",
      "Never stop learning",
    ],
    cta: "#shortstack",
    bgColor: "#020711",
    accentColor: "#D4FF00",
    textColor: "#F0F0F4",
  } satisfies ListicleProps,
  render: renderListicle,
};
