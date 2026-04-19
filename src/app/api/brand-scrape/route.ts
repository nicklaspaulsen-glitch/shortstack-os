import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Scrape a website URL and extract brand elements
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return NextResponse.json({ error: "URL must use http or https" }, { status: 400 });
    }
    // SSRF guard — block loopback / private / link-local hosts.
    {
      const host = parsedUrl.hostname.toLowerCase();
      const isPrivate =
        host === "localhost" ||
        host === "0.0.0.0" ||
        host.endsWith(".local") ||
        host.endsWith(".internal") ||
        /^127\./.test(host) ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) ||
        /^::1$/.test(host) ||
        /^fe80:/i.test(host) ||
        /^fc00:/i.test(host);
      if (isPrivate) {
        return NextResponse.json({ error: "Refusing to fetch private host" }, { status: 400 });
      }
    }

    // Fetch the website HTML
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let html: string;
    try {
      const res = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ShortStackBot/1.0; +https://shortstack.work)",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
      html = await res.text();
    } catch {
      clearTimeout(timeout);
      return NextResponse.json({ error: "Could not fetch website. Check the URL and try again." }, { status: 422 });
    }
    clearTimeout(timeout);

    // Extract brand data from HTML
    const brandData = extractBrandData(html, parsedUrl.origin);

    return NextResponse.json({ success: true, brand: brandData });
  } catch (err) {
    console.error("[brand-scrape] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

interface BrandData {
  siteName: string;
  description: string;
  favicon: string;
  ogImage: string;
  colors: string[];
  fonts: string[];
  images: string[];
  socialLinks: { platform: string; url: string }[];
  headings: string[];
  ctaTexts: string[];
}

function extractBrandData(html: string, origin: string): BrandData {
  const data: BrandData = {
    siteName: "",
    description: "",
    favicon: "",
    ogImage: "",
    colors: [],
    fonts: [],
    images: [],
    socialLinks: [],
    headings: [],
    ctaTexts: [],
  };

  // Site name from <title> or og:site_name
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) data.siteName = decodeHtmlEntities(titleMatch[1].trim());

  const ogSiteName = html.match(/property=["']og:site_name["']\s+content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["']\s+property=["']og:site_name["']/i);
  if (ogSiteName) data.siteName = decodeHtmlEntities(ogSiteName[1].trim());

  // Description
  const descMatch = html.match(/name=["']description["']\s+content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["']\s+name=["']description["']/i);
  if (descMatch) data.description = decodeHtmlEntities(descMatch[1].trim());

  // Favicon
  const faviconMatch = html.match(/rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i)
    || html.match(/href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i);
  if (faviconMatch) {
    data.favicon = resolveUrl(faviconMatch[1], origin);
  } else {
    data.favicon = `${origin}/favicon.ico`;
  }

  // OG Image
  const ogImage = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
  if (ogImage) data.ogImage = resolveUrl(ogImage[1], origin);

  // Extract colors from inline styles and CSS
  const colorRegex = /#[0-9a-fA-F]{3,8}\b/g;
  const colorMatches = html.match(colorRegex) || [];
  const colorSet = new Set<string>();
  for (const c of colorMatches) {
    const normalized = c.toLowerCase();
    // Skip common non-brand colors
    if (["#000", "#000000", "#fff", "#ffffff", "#333", "#333333", "#666", "#666666", "#999", "#ccc", "#ddd", "#eee", "#f5f5f5"].includes(normalized)) continue;
    colorSet.add(normalized.length === 4 ? expandHex(normalized) : normalized);
  }

  // Also extract rgb/rgba colors
  const rgbRegex = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;
  let rgbMatch;
  while ((rgbMatch = rgbRegex.exec(html)) !== null) {
    const hex = rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));
    if (!["#000000", "#ffffff", "#333333", "#666666"].includes(hex)) {
      colorSet.add(hex);
    }
  }
  data.colors = Array.from(colorSet).slice(0, 12);

  // Extract fonts from CSS
  const fontRegex = /font-family:\s*['"]?([^;'"}\n]+)/gi;
  const fontSet = new Set<string>();
  let fontMatch;
  while ((fontMatch = fontRegex.exec(html)) !== null) {
    const fonts = fontMatch[1].split(",").map(f => f.trim().replace(/['"]/g, ""));
    for (const f of fonts) {
      if (!["inherit", "sans-serif", "serif", "monospace", "cursive", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Arial", "Helvetica", "Times New Roman", "Georgia"].includes(f)) {
        fontSet.add(f);
      }
    }
  }

  // Google Fonts links
  const googleFontRegex = /fonts\.googleapis\.com\/css2?\?family=([^"'&\s]+)/gi;
  let gfMatch;
  while ((gfMatch = googleFontRegex.exec(html)) !== null) {
    const families = decodeURIComponent(gfMatch[1]).split("|");
    for (const fam of families) {
      fontSet.add(fam.split(":")[0].replace(/\+/g, " "));
    }
  }
  data.fonts = Array.from(fontSet).slice(0, 8);

  // Extract images (og, hero, large images)
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*/gi;
  const imgSet = new Set<string>();
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const src = resolveUrl(imgMatch[1], origin);
    // Skip tiny icons, tracking pixels, data URIs
    if (src.includes("data:") || src.includes("pixel") || src.includes("tracker") || src.includes("1x1")) continue;
    imgSet.add(src);
  }
  // Also check srcset and background-image
  const bgImgRegex = /background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/gi;
  let bgMatch;
  while ((bgMatch = bgImgRegex.exec(html)) !== null) {
    const src = resolveUrl(bgMatch[1], origin);
    if (!src.includes("data:")) imgSet.add(src);
  }
  data.images = Array.from(imgSet).slice(0, 20);

  // Social links
  const socialPlatforms: Record<string, string> = {
    "facebook.com": "Facebook", "fb.com": "Facebook",
    "twitter.com": "Twitter", "x.com": "Twitter",
    "instagram.com": "Instagram",
    "linkedin.com": "LinkedIn",
    "youtube.com": "YouTube",
    "tiktok.com": "TikTok",
    "pinterest.com": "Pinterest",
    "threads.net": "Threads",
  };
  const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const href = linkMatch[1];
    for (const [domain, platform] of Object.entries(socialPlatforms)) {
      if (href.includes(domain)) {
        data.socialLinks.push({ platform, url: href });
        break;
      }
    }
  }
  // Deduplicate social links by platform
  const seenPlatforms = new Set<string>();
  data.socialLinks = data.socialLinks.filter(s => {
    if (seenPlatforms.has(s.platform)) return false;
    seenPlatforms.add(s.platform);
    return true;
  });

  // Headings (h1, h2)
  const headingRegex = /<h[12][^>]*>([^<]+)<\/h[12]>/gi;
  let hMatch;
  while ((hMatch = headingRegex.exec(html)) !== null) {
    const text = decodeHtmlEntities(hMatch[1].trim());
    if (text.length > 3 && text.length < 200) {
      data.headings.push(text);
    }
  }
  data.headings = data.headings.slice(0, 10);

  // CTA buttons
  const ctaRegex = /<(?:a|button)[^>]*class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([^<]+)</gi;
  let ctaMatch;
  while ((ctaMatch = ctaRegex.exec(html)) !== null) {
    const text = decodeHtmlEntities(ctaMatch[1].trim());
    if (text.length > 1 && text.length < 60) {
      data.ctaTexts.push(text);
    }
  }
  data.ctaTexts = data.ctaTexts.slice(0, 8);

  return data;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function resolveUrl(url: string, origin: string): string {
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${origin}${url}`;
  return `${origin}/${url}`;
}

function expandHex(hex: string): string {
  return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
