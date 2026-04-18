/* ShortStack OS — Content Script
 * Ported from legacy extension/ sidepanel build: adds deep page
 * extraction (SEO, reviews, contacts, tech stack, schema, headings, etc.)
 * alongside the existing FAB + selection toolbar.
 */
(() => {
  /* On ShortStack pages, just set a marker so the OS knows the extension is installed */
  if ((location.hostname === "localhost" && location.port === "3000") || location.hostname.includes("shortstack.app")) {
    document.documentElement.setAttribute("data-shortstack-ext", "1");
    return;
  }

  /* ── Floating Action Button ── */
  const fab = document.createElement("button");
  fab.className = "shortstack-ext-fab";
  fab.innerHTML = "&#9889;";
  fab.title = "ShortStack OS";
  document.body.appendChild(fab);

  /* ── Sidebar ── */
  const sidebar = document.createElement("div");
  sidebar.className = "shortstack-ext-sidebar";
  sidebar.innerHTML = buildSidebar();
  document.body.appendChild(sidebar);

  fab.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar.classList.toggle("open");
    if (sidebar.classList.contains("open")) refreshSidebar();
  });

  /* Close sidebar */
  sidebar.querySelector(".shortstack-ext-close").addEventListener("click", () => sidebar.classList.remove("open"));
  document.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target) && e.target !== fab) sidebar.classList.remove("open");
  });

  /* Add-lead button inside sidebar */
  sidebar.querySelector("#ssExtAddLead").addEventListener("click", () => {
    const info = detectPageInfo();
    chrome.runtime.sendMessage({
      action: "addLead",
      data: {
        name: info.biz.name || info.title,
        business_name: info.biz.name || info.title,
        email: info.emails[0] || "",
        phone: info.phones[0] || info.biz.phone || "",
        website: location.href,
        source: location.href,
      },
      label: info.biz.name || info.title,
    });
    const btn = sidebar.querySelector("#ssExtAddLead");
    btn.textContent = "Saved!";
    setTimeout(() => (btn.textContent = "Add as Lead"), 1500);
  });

  /* ── Selection Toolbar ── */
  let toolbar = null;
  document.addEventListener("mouseup", (e) => {
    removeToolbar();
    const sel = window.getSelection().toString().trim();
    if (!sel || sel.length < 3) return;
    toolbar = document.createElement("div");
    toolbar.className = "shortstack-ext-toolbar";
    toolbar.innerHTML = `<button data-act="createPost">Post</button><button data-act="saveNote">Note</button><button data-act="summarize">Summarize</button>`;
    toolbar.style.left = `${Math.min(e.pageX, window.innerWidth - 200)}px`;
    toolbar.style.top = `${e.pageY + 10}px`;
    document.body.appendChild(toolbar);

    toolbar.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        chrome.runtime.sendMessage({
          action: btn.dataset.act,
          data: { content: sel, url: location.href },
          label: sel.slice(0, 40),
        });
        removeToolbar();
      });
    });
  });

  document.addEventListener("mousedown", () => removeToolbar());

  function removeToolbar() {
    if (toolbar) { toolbar.remove(); toolbar = null; }
  }

  /* ── Message handler for popup/background context requests ── */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "EXTRACT_PAGE") {
      try {
        sendResponse(extractFullContext());
      } catch (err) {
        sendResponse({ error: String(err) });
      }
      return true;
    }
  });

  /* ── Deep page extraction (ported from legacy extension) ── */
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
    };
  }

  function extractBasicInfo() {
    return {
      title: document.title,
      url: window.location.href,
      domain: window.location.hostname,
      bodyText: document.body?.innerText?.slice(0, 5000) || "",
    };
  }

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
      canonical: canonicalEl?.getAttribute("href") || "",
      h1Tags: h1s,
      h1Count: h1s.length,
      hasViewport: !!document.querySelector('meta[name="viewport"]'),
      schemaMarkup: schemas.slice(0, 3),
      lang: document.documentElement.lang || "",
      titleLength: document.title.length,
      descriptionLength: getMeta("description").length,
    };
  }

  function extractContactInfo() {
    const text = document.body?.innerText || "";
    const html = document.body?.innerHTML || "";
    const emails = [...new Set(
      (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])
        .filter(e => !e.includes("example") && !e.includes("test@"))
    )];
    const phones = [...new Set(
      (text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [])
    )].slice(0, 5);

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

    const addressMatch = text.match(/\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)[.,]?\s*(?:Suite|Ste|Apt|#)?\s*\d*[.,]?\s*[\w\s]+,?\s*[A-Z]{2}\s*\d{5}/i);
    return {
      emails: emails.slice(0, 5),
      phones,
      socialLinks,
      address: addressMatch ? addressMatch[0].trim() : "",
    };
  }

  function extractReviews() {
    const reviews = [];
    document.querySelectorAll('[data-review-id], .review-dialog-list .jftiEf, .WMbnJf').forEach(el => {
      const name = el.querySelector('.d4r55, .TSUbDb, [data-reviewer-name]')?.textContent?.trim() || "";
      const rating = el.querySelector('[aria-label*="star"], .kvMYJc')?.getAttribute("aria-label") || "";
      const text = el.querySelector('.wiI7pd, .MyEned, .review-full-text')?.textContent?.trim() || "";
      if (name || text) reviews.push({ name, rating, text: text.slice(0, 500), source: "google" });
    });
    document.querySelectorAll('[data-testid="review-card"], .review--with-sidebar').forEach(el => {
      const name = el.querySelector('[data-testid="user-passport-info"] a, .user-passport-info a')?.textContent?.trim() || "";
      const rating = el.querySelector('[aria-label*="star"]')?.getAttribute("aria-label") || "";
      const text = el.querySelector('[data-testid="review-text-content"], .review-content p')?.textContent?.trim() || "";
      if (name || text) reviews.push({ name, rating, text: text.slice(0, 500), source: "yelp" });
    });
    return { reviews: reviews.slice(0, 10) };
  }

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
      { name: "WordPress", test: () => allSources.includes("wp-content") || allSources.includes("wp-includes") },
      { name: "Shopify", test: () => allSources.includes("cdn.shopify.com") },
      { name: "Wix", test: () => allSources.includes("wix.com") || allSources.includes("parastorage") },
      { name: "Webflow", test: () => allSources.includes("webflow") },
      { name: "Tailwind CSS", test: () => html.includes("tailwind") || !!document.querySelector('[class*="tw-"]') },
      { name: "Google Analytics", test: () => allSources.includes("google-analytics") || allSources.includes("gtag") || allSources.includes("googletagmanager") },
      { name: "Facebook Pixel", test: () => allSources.includes("connect.facebook.net") || allSources.includes("fbevents") },
      { name: "HubSpot", test: () => allSources.includes("hubspot") },
      { name: "Stripe", test: () => allSources.includes("stripe.com") || allSources.includes("stripe.js") },
      { name: "Intercom", test: () => allSources.includes("intercom") },
    ];
    for (const d of detections) {
      try { if (d.test()) tech.push(d.name); } catch { /* ignore */ }
    }
    return { techStack: tech };
  }

  function extractFormFields() {
    return Array.from(document.querySelectorAll("input, textarea, select"))
      .slice(0, 20)
      .map(el => ({
        type: el.type || el.tagName.toLowerCase(),
        name: el.name || el.id || "",
        placeholder: el.placeholder || "",
        required: el.required || false,
        label: el.labels?.[0]?.textContent?.trim() || "",
      }));
  }

  function extractLinks() {
    return Array.from(document.querySelectorAll("a[href]"))
      .slice(0, 30)
      .map(a => ({ text: a.textContent?.trim().slice(0, 60) || "", href: a.href }))
      .filter(l => l.text && l.href);
  }

  function extractHeadings() {
    return Array.from(document.querySelectorAll("h1, h2, h3, h4"))
      .slice(0, 20)
      .map(h => ({ level: h.tagName, text: h.textContent?.trim().slice(0, 100) || "" }));
  }

  /* ── Helpers (legacy detectPageInfo, simpler) ── */
  function detectPageInfo() {
    const title = document.title || "";
    const desc = document.querySelector('meta[name="description"]')?.content || "";
    const bodyText = document.body.innerText || "";
    const emails = [...new Set((bodyText.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).slice(0, 5))];
    const phones = [...new Set((bodyText.match(/(\+?1?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g) || []).slice(0, 5))];
    let biz = {};
    const ld = document.querySelector('script[type="application/ld+json"]');
    if (ld) {
      try {
        const j = JSON.parse(ld.textContent);
        if (j["@type"] === "LocalBusiness" || j["@type"] === "Organization") {
          biz = { name: j.name, phone: j.telephone, address: j.address?.streetAddress, rating: j.aggregateRating?.ratingValue };
        }
      } catch { /* ignore malformed ld+json */ }
    }
    return { title, desc, emails, phones, biz };
  }

  function refreshSidebar() {
    const info = detectPageInfo();
    const set = (id, val) => { const el = sidebar.querySelector(`#${id}`); if (el) el.textContent = val || "—"; };
    set("ssTitle", info.title);
    set("ssDesc", info.desc || "None detected");
    set("ssEmails", info.emails.join(", ") || "None");
    set("ssPhones", info.phones.join(", ") || "None");
    if (info.biz.name) {
      set("ssBizName", info.biz.name);
      sidebar.querySelector("#ssBizSection").style.display = "block";
    }
  }

  function buildSidebar() {
    return `
      <div class="shortstack-ext-sidebar-header">
        <h2>ShortStack OS</h2>
        <button class="shortstack-ext-close">&times;</button>
      </div>
      <div class="shortstack-ext-section">
        <h3>Page Info</h3>
        <div class="shortstack-ext-row"><span class="label">Title</span><span class="value" id="ssTitle">—</span></div>
        <div class="shortstack-ext-row"><span class="label">Description</span><span class="value" id="ssDesc">—</span></div>
        <div class="shortstack-ext-row"><span class="label">Emails</span><span class="value" id="ssEmails">—</span></div>
        <div class="shortstack-ext-row"><span class="label">Phones</span><span class="value" id="ssPhones">—</span></div>
      </div>
      <div class="shortstack-ext-section" id="ssBizSection" style="display:none">
        <h3>Business Detected</h3>
        <div class="shortstack-ext-row"><span class="label">Name</span><span class="value" id="ssBizName">—</span></div>
      </div>
      <div class="shortstack-ext-section">
        <button class="shortstack-ext-btn" id="ssExtAddLead">Add as Lead</button>
      </div>`;
  }
})();
