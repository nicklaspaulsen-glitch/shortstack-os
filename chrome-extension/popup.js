/* ShortStack OS — Popup Controller */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ── Default suggestion cards ── */
const DEFAULT_SUGGESTIONS = [
  { icon: "\ud83d\udcca", title: "Analyze Competitors", desc: "Run competitor analysis on current site", featureKey: "competitor_full", prompt: "Analyze the competitors of the website I'm currently viewing." },
  { icon: "\u270d\ufe0f", title: "Write Content", desc: "Generate posts, blogs, emails", featureKey: "content_social", prompt: "Generate social media posts based on this page." },
  { icon: "\ud83c\udfaf", title: "Find Leads", desc: "Extract business contacts", featureKey: "extract_leads", prompt: "Extract any business contacts, emails, or lead information from this page." },
  { icon: "\ud83d\udcf1", title: "Manage Ads", desc: "View and optimize campaigns", prompt: "Help me plan and optimize ad campaigns related to the content on this page." },
  { icon: "\ud83d\udd0d", title: "SEO Audit", desc: "Check SEO health of page", featureKey: "seo_audit", prompt: "Perform an SEO audit of this page." },
  { icon: "\ud83d\udcc8", title: "Page Insights", desc: "Analytics and performance", prompt: "Give me insights and analysis about this page — content quality, audience, and key takeaways." },
];

/* ── URL-adaptive suggestions ── */
const URL_OVERRIDES = [
  {
    test: (url) => /google\.com\/maps|maps\.google/.test(url),
    cards: [
      { icon: "\ud83c\udfea", title: "Extract Businesses", desc: "Pull business listings from map", prompt: "Extract all business names, addresses, phone numbers, and ratings visible on this Google Maps page." },
      { icon: "\ud83d\udcde", title: "Get Contacts", desc: "Find phone numbers & emails", prompt: "Find all contact information (phone, email, website) for businesses shown on this map page." },
      { icon: "\u2b50", title: "Analyze Reviews", desc: "Summarize review sentiment", prompt: "Analyze the reviews and ratings for businesses on this page. Summarize sentiment and key themes." },
      { icon: "\ud83d\udccd", title: "Local SEO Tips", desc: "Improve local search ranking", prompt: "Give me local SEO tips for a business in this area based on what I see on this map page." },
      { icon: "\ud83d\udcca", title: "Competitor Map", desc: "Compare nearby competitors", prompt: "Compare the businesses visible on this map. Who are the top competitors and why?" },
      { icon: "\ud83d\udce5", title: "Export Leads", desc: "Save businesses as leads", prompt: "Help me save all the businesses shown on this map page as leads in my CRM." },
    ],
  },
  {
    test: (url) => /facebook\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com|tiktok\.com/.test(url),
    cards: [
      { icon: "\ud83d\udc64", title: "Analyze Profile", desc: "Review social media presence", prompt: "Analyze this social media profile. What's their posting strategy, engagement rate, and audience?" },
      { icon: "\ud83d\udcdd", title: "Draft Response", desc: "Write a reply or comment", prompt: "Draft a professional and engaging reply to the content on this social media page." },
      { icon: "\ud83d\udcc8", title: "Growth Tips", desc: "Improve social strategy", prompt: "Based on this social media profile, suggest growth strategies and content improvements." },
      { icon: "\ud83c\udfaf", title: "Ad Targeting", desc: "Find target audience", prompt: "Based on this social profile's audience, suggest ad targeting parameters and campaign ideas." },
      { icon: "\ud83d\udd17", title: "Find Leads", desc: "Extract contacts from profile", prompt: "Extract any business contact information or lead data from this social media page." },
      { icon: "\u270d\ufe0f", title: "Content Ideas", desc: "Generate post ideas", prompt: "Generate 5 content ideas inspired by this social media page that would engage a similar audience." },
    ],
  },
  {
    test: (url) => /yelp\.com/.test(url),
    cards: [
      { icon: "\u2b50", title: "Review Analysis", desc: "Summarize customer reviews", prompt: "Analyze all the reviews on this Yelp page. What are the key themes, complaints, and praises?" },
      { icon: "\ud83c\udfea", title: "Business Intel", desc: "Extract business details", prompt: "Extract all business information from this Yelp page — name, address, phone, hours, category." },
      { icon: "\ud83d\udcca", title: "Competitor Compare", desc: "Compare with similar businesses", prompt: "Compare this Yelp business with its competitors. What makes it stand out or fall behind?" },
      { icon: "\ud83d\udcde", title: "Get Contacts", desc: "Pull contact info", prompt: "Extract contact information and business details from this Yelp listing." },
      { icon: "\ud83d\udcdd", title: "Write Review Reply", desc: "Draft owner responses", prompt: "Draft professional owner responses to the recent reviews on this Yelp page." },
      { icon: "\ud83d\udcc8", title: "Improvement Tips", desc: "Boost Yelp presence", prompt: "Based on this Yelp listing, suggest improvements to boost ratings and attract more customers." },
    ],
  },
];

/* ── Feature Prompts (ported from legacy sidepanel extension) ──
 * Rich, structured prompts for competitor / SEO / review / content tasks.
 * Exposed via the suggestion cards (URL_OVERRIDES + defaults) and any
 * future quick-feature buttons. Keep these in sync with suggestion cards. */
const FEATURE_PROMPTS = {
  competitor_full: `Analyze this website as a competitor. Provide:
1. **Business Overview** — What they do, who they target
2. **Strengths** — What they do well
3. **Weaknesses** — Gaps, missing features, poor UX
4. **Pricing Strategy** — If visible
5. **Marketing Approach** — Tone, messaging, value props
6. **Opportunities** — How to compete against them
Rate overall threat level 1-10.`,
  seo_audit: `Perform an SEO audit of this page. Score each 1-10:
title tag, meta description, headings structure, content quality, internal links,
image alt text, URL structure, mobile signals, page speed, schema markup.
Give an overall score out of 100 and the top 3 quick wins.`,
  content_social: `Create 3 social posts from this page's content:
1. Instagram/TikTok — hook + value + CTA with hashtags
2. LinkedIn — professional angle, 3-4 paragraphs
3. Twitter/X — punchy, under 280 chars
Make each platform-native, not a copy-paste.`,
  review_respond: `Find customer reviews on this page. For each review:
identify reviewer + rating, summarize feedback, write a warm 2-3 sentence response.`,
  extract_leads: `Extract business lead info: name, industry, location, contact info,
social media, services offered, and a Hot/Warm/Cold quality rating.`,
};

/* ── Chat State ── */
let chatHistory = [];
let currentTabUrl = "";
let currentPageContext = null; // Populated from content-script EXTRACT_PAGE
let isSending = false;

/* ── Init ── */
document.addEventListener("DOMContentLoaded", async () => {
  const auth = await msg("checkAuth");
  if (auth?.data?.connected) {
    showMain();
  } else {
    showAuth();
  }
  loadActivity();
  await initChat();
  await initSuggestions();
});

/* ── View Switching ── */
function showMain() {
  $("#authGate").classList.add("hidden");
  $("#mainContent").classList.remove("hidden");
  $("#settingsPanel").classList.add("hidden");
  $("#statusDot").className = "ss-status connected";
  $("#statusDot").title = "Connected";
}
function showAuth() {
  $("#authGate").classList.remove("hidden");
  $("#mainContent").classList.add("hidden");
  $("#settingsPanel").classList.add("hidden");
  $("#statusDot").className = "ss-status disconnected";
  $("#statusDot").title = "Not connected";
}
function showSettings() {
  $("#authGate").classList.add("hidden");
  $("#mainContent").classList.add("hidden");
  $("#settingsPanel").classList.remove("hidden");
  chrome.storage.sync.get(["apiKey", "baseUrl", "automationMode"], (d) => {
    $("#cfgApiKey").value = d.apiKey || "";
    $("#cfgBaseUrl").value = d.baseUrl || "http://localhost:3000";
    $("#cfgAutomation").checked = d.automationMode || false;
  });
}

/* ── Auth / Settings ── */
// Primary login flow: opens /extension-auth in a new tab. The page calls
// back into the extension via externally_connectable with the tokens.
$("#loginBtn").addEventListener("click", async () => {
  await msg("startLogin");
  // Poll for connection for ~20s. Cheaper than a storage listener and
  // handles the case where the user closed the handshake tab early.
  const startedAt = Date.now();
  const poll = async () => {
    if (Date.now() - startedAt > 20000) return;
    const a = await msg("checkAuth");
    if (a?.data?.connected) { showMain(); location.reload(); return; }
    setTimeout(poll, 800);
  };
  poll();
});

$("#openSettings").addEventListener("click", showSettings);
$("#settingsToggle").addEventListener("click", showSettings);
$("#settingsCancel").addEventListener("click", async () => {
  const auth = await msg("checkAuth");
  auth?.data?.connected ? showMain() : showAuth();
});
$("#settingsSave").addEventListener("click", () => {
  const apiKey = $("#cfgApiKey").value.trim();
  const baseUrl = $("#cfgBaseUrl").value.trim() || "http://localhost:3000";
  const automationMode = $("#cfgAutomation").checked;
  chrome.storage.sync.set({ apiKey, baseUrl, automationMode }, () => {
    apiKey ? showMain() : showAuth();
  });
});

/* ── Automation Mode toggle warning ── */
$("#cfgAutomation").addEventListener("change", (e) => {
  if (e.target.checked) {
    alert("Automation mode lets the AI interact with web pages directly. Use with caution.");
  }
});

/* ── Chat ── */
async function initChat() {
  // Get current tab URL + try to pull deep page context from content script
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabUrl = tab?.url || "";
    if (tab?.id) {
      // Ask the content script for the full extracted context. Silently
      // tolerate chrome:// / extension gallery / PDF pages where content
      // scripts cannot inject.
      try {
        currentPageContext = await new Promise((resolve) => {
          chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE" }, (res) => {
            if (chrome.runtime.lastError || !res || res.error) resolve(null);
            else resolve(res);
          });
        });
      } catch (_) { currentPageContext = null; }
    }
  } catch (_) {}

  // Load stored chat history
  const stored = await chrome.storage.local.get("chatHistory");
  chatHistory = (stored.chatHistory || []).slice(-50);
  renderChatHistory();

  // Input handlers
  const input = $("#chatInput");
  const sendBtn = $("#chatSend");

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
  sendBtn.addEventListener("click", sendChatMessage);
}

async function sendChatMessage() {
  const input = $("#chatInput");
  const text = input.value.trim();
  if (!text || isSending) return;

  isSending = true;
  input.value = "";
  $("#chatSend").disabled = true;

  // Hide placeholder
  const placeholder = $("#chatPlaceholder");
  if (placeholder) placeholder.remove();

  // Add user message
  appendMessage("user", text);
  chatHistory.push({ role: "user", content: text, ts: Date.now() });

  // Show typing indicator
  const typing = showTypingIndicator();

  try {
    // Build a compact page-context blob from the deep extraction if we
    // have it — otherwise fall back to the popup document's title.
    const pageCtx = buildPageContextSummary();
    const res = await msg("chatWithAI", { message: text, url: currentTabUrl, pageContext: pageCtx });
    typing.remove();

    const aiText = res?.data?.response || res?.data?.message || "Sorry, I couldn't process that request.";
    appendMessage("ai", aiText);
    chatHistory.push({ role: "ai", content: aiText, ts: Date.now() });
  } catch (e) {
    typing.remove();
    const errText = "Something went wrong. Please check your connection and try again.";
    appendMessage("ai", errText);
    chatHistory.push({ role: "ai", content: errText, ts: Date.now() });
  }

  // Persist (keep last 50)
  await chrome.storage.local.set({ chatHistory: chatHistory.slice(-50) });

  isSending = false;
  $("#chatSend").disabled = false;
  input.focus();
}

function appendMessage(role, text) {
  const container = $("#chatMessages");
  const div = document.createElement("div");
  div.className = `ss-chat-msg ${role}`;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function renderChatHistory() {
  if (chatHistory.length === 0) return;

  // Hide placeholder
  const placeholder = $("#chatPlaceholder");
  if (placeholder) placeholder.remove();

  chatHistory.forEach((m) => {
    appendMessage(m.role, m.content);
  });
}

function buildPageContextSummary() {
  // Fall back to just the popup title (which is the extension title, not
  // the tab's) if we never got a content-script context — still useful.
  if (!currentPageContext) return document.title;
  const p = currentPageContext;
  const parts = [];
  if (p.title) parts.push(`Title: ${p.title}`);
  if (p.metaDescription) parts.push(`Description: ${p.metaDescription}`);
  if (p.headings?.length) {
    parts.push(`Headings: ${p.headings.slice(0, 6).map((h) => `${h.level}:${h.text}`).join(" | ")}`);
  }
  if (p.techStack?.length) parts.push(`Tech: ${p.techStack.slice(0, 6).join(", ")}`);
  if (p.emails?.length) parts.push(`Emails: ${p.emails.slice(0, 3).join(", ")}`);
  if (p.phones?.length) parts.push(`Phones: ${p.phones.slice(0, 3).join(", ")}`);
  if (p.bodyText) parts.push(`Body excerpt: ${p.bodyText.slice(0, 1200)}`);
  return parts.join(" | ").slice(0, 3500);
}

function showTypingIndicator() {
  const container = $("#chatMessages");
  const div = document.createElement("div");
  div.className = "ss-chat-typing";
  div.innerHTML = "<span></span><span></span><span></span>";
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

/* ── Smart Suggestions ── */
async function initSuggestions() {
  let url = currentTabUrl;
  if (!url) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      url = tab?.url || "";
    } catch (_) {}
  }

  // Find URL-specific override or use defaults
  const override = URL_OVERRIDES.find((o) => o.test(url));
  const cards = override ? override.cards : DEFAULT_SUGGESTIONS;

  const grid = $("#suggestionsGrid");
  grid.innerHTML = "";

  cards.forEach((card) => {
    const el = document.createElement("div");
    el.className = "ss-suggest-card";
    el.innerHTML = `
      <span class="ss-suggest-icon">${card.icon}</span>
      <span class="ss-suggest-title">${esc(card.title)}</span>
      <span class="ss-suggest-desc">${esc(card.desc)}</span>
    `;
    el.addEventListener("click", () => {
      // Pre-fill the chat input and send. If a card declares a featureKey,
      // use the richer FEATURE_PROMPTS template ported from legacy extension.
      const input = $("#chatInput");
      input.value = (card.featureKey && FEATURE_PROMPTS[card.featureKey]) || card.prompt;
      sendChatMessage();
    });
    grid.appendChild(el);
  });
}

/* ── Quick Actions ── */
const FORMS = {
  addLead: {
    title: "Add Lead",
    fields: [
      { name: "name", label: "Business Name", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone", type: "tel" },
    ],
    submit: async (d, tab) => msg("addLead", { ...d, source: tab.url }, "Added lead"),
  },
  createPost: {
    title: "Create Post",
    fields: [{ name: "content", label: "Post Content", type: "textarea" }],
    submit: async (d, tab) => msg("createPost", { ...d, sourceUrl: tab.url }, "Created post draft"),
  },
  summarize: {
    title: "Summarize Page",
    fields: [],
    submit: async (_d, tab) => msg("summarize", { url: tab.url }, "Summarized page"),
  },
  saveNote: {
    title: "Save to Notion",
    fields: [{ name: "content", label: "Content / Selection", type: "textarea" }],
    submit: async (d, tab) => msg("saveNote", { ...d, url: tab.url }, "Saved to Notion"),
  },
  trackCompetitor: {
    title: "Track Competitor",
    fields: [{ name: "notes", label: "Notes (optional)", type: "text" }],
    submit: async (d, tab) => msg("trackCompetitor", { url: tab.url, ...d }, "Tracking competitor"),
  },
  quickNote: {
    title: "Quick Note",
    fields: [{ name: "content", label: "Note", type: "textarea" }],
    submit: async (d, tab) => msg("saveNote", { ...d, url: tab.url, type: "quick" }, "Note saved"),
  },
};

$$(".ss-action").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const key = btn.dataset.action;
    const cfg = FORMS[key];
    if (!cfg) return;

    if (cfg.fields.length === 0) {
      btn.textContent = "...";
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await cfg.submit({}, tab);
      btn.innerHTML = `<span class="ss-icon">&#10003;</span>Done`;
      setTimeout(() => location.reload(), 800);
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    openForm(cfg, tab);
  });
});

function openForm(cfg, tab) {
  $("#formTitle").textContent = cfg.title;
  const body = $("#formBody");
  body.innerHTML = "";
  cfg.fields.forEach((f) => {
    const lbl = document.createElement("label");
    lbl.textContent = f.label;
    const el = document.createElement(f.type === "textarea" ? "textarea" : "input");
    el.type = f.type === "textarea" ? undefined : f.type;
    el.name = f.name;
    el.placeholder = f.label;
    lbl.appendChild(el);
    body.appendChild(lbl);
  });
  $("#inlineForm").classList.remove("hidden");
  $("#formCancel").onclick = () => $("#inlineForm").classList.add("hidden");
  $("#formSubmit").onclick = async () => {
    const data = {};
    body.querySelectorAll("input, textarea").forEach((el) => (data[el.name] = el.value));
    $("#formSubmit").textContent = "Saving...";
    await cfg.submit(data, tab);
    $("#inlineForm").classList.add("hidden");
    $("#formSubmit").textContent = "Save";
    loadActivity();
  };
}

/* ── Activity ── */
async function loadActivity() {
  const res = await msg("getActivity");
  const list = $("#activityList");
  const items = res?.data || [];
  if (!items.length) {
    list.innerHTML = '<li class="empty">No recent activity</li>';
    return;
  }
  list.innerHTML = items
    .map((a) => `<li><span class="act-label">${esc(a.action)} — ${esc(a.detail || "")}</span><span class="act-time">${timeAgo(a.ts)}</span></li>`)
    .join("");
}

/* ── Helpers ── */
function msg(action, data, label) {
  return chrome.runtime.sendMessage({ action, data, label });
}
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
