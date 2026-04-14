/**
 * ShortStack OS — Content Script
 * Runs on all pages to extract page context, reviews, SEO data, and provide browser interaction.
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "EXTRACT_PAGE") {
    const pageData = extractFullContext();
    sendResponse(pageData);
    return true;
  }

  if (msg.type === "HIGHLIGHT_ELEMENT") {
    highlightElement(msg.selector);
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "CLICK_ELEMENT") {
    try {
      const el = document.querySelector(msg.selector);
      if (el) { el.click(); sendResponse({ success: true }); }
      else sendResponse({ error: "Element not found" });
    } catch (e) { sendResponse({ error: String(e) }); }
    return true;
  }

  if (msg.type === "FILL_INPUT") {
    try {
      const el = document.querySelector(msg.selector);
      if (el) {
        el.value = msg.value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        sendResponse({ success: true });
      } else sendResponse({ error: "Element not found" });
    } catch (e) { sendResponse({ error: String(e) }); }
    return true;
  }

  if (msg.type === "SCROLL_TO") {
    try {
      const el = msg.selector ? document.querySelector(msg.selector) : null;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      else window.scrollTo({ top: msg.y || 0, behavior: "smooth" });
      sendResponse({ success: true });
    } catch (e) { sendResponse({ error: String(e) }); }
    return true;
  }
});

function extractFullContext() {
  return {
    ...extractBasicInfo(),
    ...extractSEOData(),
    ...extractContactInfo(),
    ...extractReviews(),
    ...extractTechStack(),
    inputs: extractFormFields(),
    links: extractLinks(),
    headings: extractHeadings(),
    images: extractImages(),
  };
}

// ── Basic Page Info ──
function extractBasicInfo() {
  return {
    title: document.title,
    url: window.location.href,
    domain: window.location.hostname,
    bodyText: document.body?.innerText?.slice(0, 5000) || "",
  };
}

// ── SEO Data ──
function extractSEOData() {
  const getMeta = (name) => {
    const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return el?.getAttribute("content") || "";
  };

  const canonicalEl = document.querySelector('link[rel="canonical"]');
  const h1s = Array.from(document.querySelectorAll("h1")).map(h => h.textContent?.trim()).filter(Boolean);
  const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => {
    try { return JSON.parse(s.textContent || ""); } catch { return null; }
  }).filter(Boolean);

  return {
    metaDescription: getMeta("description"),
    metaKeywords: getMeta("keywords"),
    ogTitle: getMeta("og:title"),
    ogDescription: getMeta("og:description"),
    ogImage: getMeta("og:image"),
    ogType: getMeta("og:type"),
    twitterCard: getMeta("twitter:card"),
    twitterTitle: getMeta("twitter:title"),
    canonical: canonicalEl?.getAttribute("href") || "",
    h1Tags: h1s,
    h1Count: h1s.length,
    hasViewport: !!document.querySelector('meta[name="viewport"]'),
    hasCharset: !!document.querySelector('meta[charset]'),
    schemaMarkup: schemas.slice(0, 3),
    robotsMeta: getMeta("robots"),
    lang: document.documentElement.lang || "",
    titleLength: document.title.length,
    descriptionLength: getMeta("description").length,
  };
}

// ── Contact Info Extraction ──
function extractContactInfo() {
  const text = document.body?.innerText || "";
  const html = document.body?.innerHTML || "";

  // Email regex
  const emails = [...new Set(
    (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])
      .filter(e => !e.includes("example") && !e.includes("test@"))
  )];

  // Phone regex (various formats)
  const phones = [...new Set(
    (text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [])
  )].slice(0, 5);

  // Social media links
  const socialLinks = {};
  const socialPatterns = {
    instagram: /instagram\.com\/([^\/\s"'?]+)/,
    facebook: /facebook\.com\/([^\/\s"'?]+)/,
    twitter: /(?:twitter|x)\.com\/([^\/\s"'?]+)/,
    linkedin: /linkedin\.com\/(?:company|in)\/([^\/\s"'?]+)/,
    tiktok: /tiktok\.com\/@?([^\/\s"'?]+)/,
    youtube: /youtube\.com\/(?:c\/|channel\/|@)?([^\/\s"'?]+)/,
  };

  for (const [platform, regex] of Object.entries(socialPatterns)) {
    const match = html.match(regex);
    if (match) socialLinks[platform] = match[0];
  }

  // Physical address (basic detection)
  const addressMatch = text.match(/\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)[.,]?\s*(?:Suite|Ste|Apt|#)?\s*\d*[.,]?\s*[\w\s]+,?\s*[A-Z]{2}\s*\d{5}/i);
  const address = addressMatch ? addressMatch[0].trim() : "";

  return {
    emails: emails.slice(0, 5),
    phones,
    socialLinks,
    address,
  };
}

// ── Review Extraction ──
function extractReviews() {
  const reviews = [];

  // Google Reviews
  document.querySelectorAll('[data-review-id], .review-dialog-list .jftiEf, .WMbnJf').forEach(el => {
    const name = el.querySelector('.d4r55, .TSUbDb, [data-reviewer-name]')?.textContent?.trim() || "";
    const rating = el.querySelector('[aria-label*="star"], .kvMYJc')?.getAttribute("aria-label") || "";
    const text = el.querySelector('.wiI7pd, .MyEned, .review-full-text')?.textContent?.trim() || "";
    const date = el.querySelector('.rsqaWe, .dehysf')?.textContent?.trim() || "";
    if (name || text) reviews.push({ name, rating, text: text.slice(0, 500), date, source: "google" });
  });

  // Yelp Reviews
  document.querySelectorAll('[data-testid="review-card"], .review--with-sidebar').forEach(el => {
    const name = el.querySelector('[data-testid="user-passport-info"] a, .user-passport-info a')?.textContent?.trim() || "";
    const rating = el.querySelector('[aria-label*="star"]')?.getAttribute("aria-label") || "";
    const text = el.querySelector('[data-testid="review-text-content"], .review-content p')?.textContent?.trim() || "";
    const date = el.querySelector('time, .review-date')?.textContent?.trim() || "";
    if (name || text) reviews.push({ name, rating, text: text.slice(0, 500), date, source: "yelp" });
  });

  // TrustPilot
  document.querySelectorAll('[data-service-review-card-paper], .review-card').forEach(el => {
    const name = el.querySelector('[data-consumer-name-typography], .consumer-information__name')?.textContent?.trim() || "";
    const rating = el.querySelector('[data-service-review-rating]')?.getAttribute("data-service-review-rating") || "";
    const text = el.querySelector('[data-service-review-text-typography], .review-content__text')?.textContent?.trim() || "";
    const date = el.querySelector('time')?.getAttribute("datetime") || "";
    if (name || text) reviews.push({ name, rating, text: text.slice(0, 500), date, source: "trustpilot" });
  });

  // Generic review pattern (works on many sites)
  if (reviews.length === 0) {
    document.querySelectorAll('[class*="review"], [class*="Review"], [data-testid*="review"]').forEach(el => {
      const text = el.textContent?.trim().slice(0, 500) || "";
      const stars = el.querySelector('[class*="star"], [aria-label*="star"]');
      if (text.length > 30) {
        reviews.push({
          text,
          rating: stars?.getAttribute("aria-label") || "",
          source: "generic",
          name: "",
          date: "",
        });
      }
    });
  }

  return { reviews: reviews.slice(0, 20) };
}

// ── Tech Stack Detection ──
function extractTechStack() {
  const tech = [];
  const html = document.documentElement.outerHTML || "";
  const scripts = Array.from(document.querySelectorAll("script[src]")).map(s => s.src);
  const links = Array.from(document.querySelectorAll("link[href]")).map(l => l.href);
  const allSources = [...scripts, ...links, html].join(" ");

  const detections = [
    { name: "React", test: () => !!document.querySelector("[data-reactroot], [data-reactid]") || allSources.includes("react") },
    { name: "Next.js", test: () => !!document.querySelector("#__next") || allSources.includes("_next/") },
    { name: "Vue.js", test: () => !!document.querySelector("[data-v-]") || allSources.includes("vue") },
    { name: "Angular", test: () => !!document.querySelector("[ng-app], [ng-controller], app-root") || allSources.includes("angular") },
    { name: "WordPress", test: () => allSources.includes("wp-content") || allSources.includes("wp-includes") },
    { name: "Shopify", test: () => allSources.includes("cdn.shopify.com") || allSources.includes("shopify") },
    { name: "Wix", test: () => allSources.includes("wix.com") || allSources.includes("parastorage") },
    { name: "Squarespace", test: () => allSources.includes("squarespace.com") || allSources.includes("sqsp") },
    { name: "Webflow", test: () => allSources.includes("webflow") },
    { name: "Tailwind CSS", test: () => html.includes("tailwind") || document.querySelector('[class*="tw-"]') },
    { name: "Bootstrap", test: () => allSources.includes("bootstrap") },
    { name: "jQuery", test: () => allSources.includes("jquery") },
    { name: "Google Analytics", test: () => allSources.includes("google-analytics") || allSources.includes("gtag") || allSources.includes("googletagmanager") },
    { name: "Google Tag Manager", test: () => allSources.includes("googletagmanager.com") },
    { name: "Facebook Pixel", test: () => allSources.includes("connect.facebook.net") || allSources.includes("fbevents") },
    { name: "Hotjar", test: () => allSources.includes("hotjar") },
    { name: "Intercom", test: () => allSources.includes("intercom") || !!document.querySelector("#intercom-frame") },
    { name: "Drift", test: () => allSources.includes("drift.com") || !!document.querySelector("#drift-widget") },
    { name: "HubSpot", test: () => allSources.includes("hubspot") || allSources.includes("hs-scripts") },
    { name: "Stripe", test: () => allSources.includes("stripe.com") || allSources.includes("stripe.js") },
    { name: "Cloudflare", test: () => allSources.includes("cloudflare") || allSources.includes("cf-") },
    { name: "Vercel", test: () => allSources.includes("vercel") || allSources.includes("_vercel") },
    { name: "Netlify", test: () => allSources.includes("netlify") },
    { name: "Framer", test: () => allSources.includes("framer") },
    { name: "Supabase", test: () => allSources.includes("supabase") },
    { name: "Firebase", test: () => allSources.includes("firebase") || allSources.includes("firebaseapp") },
    { name: "TikTok Pixel", test: () => allSources.includes("analytics.tiktok.com") },
    { name: "LinkedIn Insight", test: () => allSources.includes("snap.licdn.com") || allSources.includes("linkedin.com/collect") },
    { name: "Crisp", test: () => allSources.includes("crisp.chat") },
    { name: "Zendesk", test: () => allSources.includes("zendesk") },
    { name: "Calendly", test: () => allSources.includes("calendly") },
    { name: "Mailchimp", test: () => allSources.includes("mailchimp") || allSources.includes("chimpstatic") },
  ];

  for (const d of detections) {
    try { if (d.test()) tech.push(d.name); } catch {}
  }

  return { techStack: tech };
}

// ── Form Fields ──
function extractFormFields() {
  return Array.from(document.querySelectorAll("input, textarea, select"))
    .slice(0, 20)
    .map(el => ({
      type: el.type || el.tagName.toLowerCase(),
      name: el.name || el.id || "",
      placeholder: el.placeholder || "",
      value: el.type === "password" ? "***" : (el.value || "").slice(0, 100),
      required: el.required || false,
      label: el.labels?.[0]?.textContent?.trim() || "",
    }));
}

// ── Links ──
function extractLinks() {
  return Array.from(document.querySelectorAll("a[href]"))
    .slice(0, 30)
    .map(a => ({ text: a.textContent?.trim().slice(0, 60) || "", href: a.href }))
    .filter(l => l.text && l.href);
}

// ── Headings ──
function extractHeadings() {
  return Array.from(document.querySelectorAll("h1, h2, h3, h4"))
    .slice(0, 20)
    .map(h => ({ level: h.tagName, text: h.textContent?.trim().slice(0, 100) || "" }));
}

// ── Images ──
function extractImages() {
  return Array.from(document.querySelectorAll("img"))
    .slice(0, 15)
    .map(img => ({
      src: img.src || "",
      alt: img.alt || "",
      width: img.naturalWidth || img.width || 0,
      height: img.naturalHeight || img.height || 0,
      hasAlt: !!img.alt,
    }));
}

// ── Element Highlighting ──
function highlightElement(selector) {
  document.querySelectorAll(".ss-highlight").forEach(el => el.remove());
  try {
    const el = document.querySelector(selector);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.className = "ss-highlight";
    overlay.style.cssText = `
      position:fixed;top:${rect.top-4}px;left:${rect.left-4}px;
      width:${rect.width+8}px;height:${rect.height+8}px;
      border:2px solid #C9A84C;border-radius:6px;
      background:rgba(201,168,76,0.08);pointer-events:none;
      z-index:999999;transition:opacity 0.3s;
    `;
    document.body.appendChild(overlay);
    setTimeout(() => { overlay.style.opacity = "0"; setTimeout(() => overlay.remove(), 300); }, 3000);
  } catch {}
}
