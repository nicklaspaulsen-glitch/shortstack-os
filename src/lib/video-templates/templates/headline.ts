/**
 * "Headline" template — cinematic bold text reveal, 9:16 TikTok format.
 *
 * Layers:
 *   1. Full-bleed brand-color background
 *   2. Optional background image (blurred, darkened)
 *   3. Large headline text — slides up + fades in at 0.4s
 *   4. Optional subheadline — fades in at 1.2s
 *   5. Optional hashtag/CTA — fades in at 2.0s
 *   6. Subtle noise grain via SVG filter
 *
 * Total duration: 5 seconds
 */

export interface HeadlineProps {
  headline: string;
  subheadline?: string;
  cta?: string;
  bgColor?: string;       // e.g. "#020711"
  accentColor?: string;   // e.g. "#D4FF00"
  textColor?: string;     // e.g. "#F0F0F4"
  bgImageUrl?: string;    // Optional background image URL
  fontFamily?: string;    // Default: "Inter, sans-serif"
}

export function renderHeadline(props: HeadlineProps): string {
  const {
    headline,
    subheadline = "",
    cta = "",
    bgColor = "#020711",
    accentColor = "#D4FF00",
    textColor = "#F0F0F4",
    bgImageUrl = "",
    fontFamily = "Inter, -apple-system, sans-serif",
  } = props;

  // Escape HTML special chars
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<title>Headline</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1080px;height:1920px;overflow:hidden;background:${esc(bgColor)};font-family:${esc(fontFamily)}}

  /* Noise grain filter */
  .grain{position:fixed;inset:0;pointer-events:none;opacity:0.035;z-index:100;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
    background-size:200px 200px;mix-blend-mode:overlay}

  /* Background image layer */
  .bg-image{position:absolute;inset:0;z-index:0;background-size:cover;background-position:center;
    ${bgImageUrl ? `background-image:url("${esc(bgImageUrl)}");` : ""}
    filter:blur(8px) brightness(0.45) saturate(0.8);transform:scale(1.05)}

  /* Dark vignette over image */
  .vignette{position:absolute;inset:0;z-index:1;
    background:radial-gradient(ellipse 80% 80% at 50% 50%,transparent 40%,rgba(0,0,0,0.7) 100%)}

  /* Accent line */
  .accent-line{position:absolute;left:80px;top:50%;transform:translateY(-120px);
    width:48px;height:4px;border-radius:2px;background:${esc(accentColor)};z-index:2;
    animation:lineIn 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both;transform-origin:left center}
  @keyframes lineIn{from{transform:translateY(-120px) scaleX(0)}to{transform:translateY(-120px) scaleX(1)}}

  /* Main headline */
  .headline{position:absolute;left:80px;right:80px;top:50%;transform:translateY(-60px);z-index:2;
    font-size:112px;font-weight:800;line-height:1.0;letter-spacing:-0.03em;
    color:${esc(textColor)};
    animation:headlineIn 0.7s cubic-bezier(0.16,1,0.3,1) 0.4s both}
  @keyframes headlineIn{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(-60px)}}

  /* Subheadline */
  .subheadline{position:absolute;left:80px;right:80px;top:calc(50% + 160px);z-index:2;
    font-size:44px;font-weight:400;line-height:1.4;letter-spacing:-0.01em;
    color:rgba(240,240,244,0.7);
    animation:fadeIn 0.6s ease-out 1.2s both}

  /* CTA */
  .cta{position:absolute;left:80px;bottom:160px;z-index:2;
    font-size:32px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;
    color:${esc(accentColor)};
    animation:fadeIn 0.6s ease-out 2.0s both}

  @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
</style>
</head>
<body>
  ${bgImageUrl ? '<div class="bg-image"></div><div class="vignette"></div>' : ""}
  <div class="grain"></div>
  <div class="accent-line"></div>
  <div class="headline">${esc(headline)}</div>
  ${subheadline ? `<div class="subheadline">${esc(subheadline)}</div>` : ""}
  ${cta ? `<div class="cta">${esc(cta)}</div>` : ""}
</body>
</html>`;
}

export const headlineTemplate = {
  id: "headline",
  name: "Headline",
  description: "Bold cinematic text reveal — great for announcements and breaking news.",
  category: "text",
  aspectRatio: "9:16" as const,
  durationSeconds: 5,
  previewGradient: "linear-gradient(135deg, #020711 0%, #0D1120 60%, #3B82F620 100%)",
  defaultProps: {
    headline: "Your bold headline here",
    subheadline: "Supporting context in one short line",
    cta: "#shortstack",
    bgColor: "#020711",
    accentColor: "#D4FF00",
    textColor: "#F0F0F4",
  } satisfies HeadlineProps,
  render: renderHeadline,
};
