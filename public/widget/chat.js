/*!
 * ShortStack Chat Widget
 * Drop-in embeddable chat — renders a floating bubble that expands into a
 * chat panel. Designed to live on customer sites; talks only to the origin
 * that served it, with NO external deps.
 *
 * Config (via <script> data-attrs on the tag that loaded this file):
 *   data-token         Widget token (cw_…) — issued by hub-setup/chat
 *   data-hub-id        Alias for data-token (legacy name, still honoured)
 *   data-theme         "light" | "dark"  (default: "light")
 *   data-primary       CSS color string   (default: "#C9A84C")
 *   data-position      "bottom-right" | "bottom-left" (default: "bottom-right")
 *   data-greeting      Welcome message (default greeting otherwise)
 *   data-name          Hub display name in header (default: "Chat")
 *
 * Exposes window.ShortStackChat = { open(), close(), toggle(), destroy() }.
 */
(function () {
  "use strict";

  // Bail if already loaded (guards against double-embed).
  if (window.ShortStackChat) return;

  // ---------- Locate own <script> tag and read config ----------
  // document.currentScript is set while the script is initially running.
  // Fallback: last <script> on the page with /widget/chat.js in src.
  var selfScript =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].src && scripts[i].src.indexOf("/widget/chat.js") !== -1) {
          return scripts[i];
        }
      }
      return null;
    })();

  if (!selfScript) {
    // Nothing to anchor config to — refuse to init rather than guess.
    return;
  }

  // Pin the origin we talk to so it doesn't matter that the host page may
  // live on a totally different domain.
  var ORIGIN = (function () {
    try {
      return new URL(selfScript.src).origin;
    } catch (e) {
      return "";
    }
  })();
  if (!ORIGIN) return;

  var ds = selfScript.dataset || {};
  var TOKEN = ds.token || ds.hubId || "";
  if (!TOKEN) {
    // No widget token = can't authenticate writes. Log once and bail.
    if (window.console && console.warn) {
      console.warn("[ShortStack Chat] missing data-token on script tag; widget not loaded");
    }
    return;
  }

  var cfg = {
    token: TOKEN,
    theme: ds.theme === "dark" ? "dark" : "light",
    primary: ds.primary || "#C9A84C",
    position: ds.position === "bottom-left" ? "bottom-left" : "bottom-right",
    greeting: ds.greeting || "Hi there! How can we help?",
    name: ds.name || "Chat",
  };

  // ---------- localStorage session key ----------
  var SESSION_KEY = "shortstack_chat_session_" + TOKEN;
  var EMAIL_KEY = "shortstack_chat_email_" + TOKEN;
  var sessionId = "";
  try {
    sessionId = localStorage.getItem(SESSION_KEY) || "";
  } catch (e) { /* private mode — fine */ }
  if (!sessionId) {
    sessionId = "ss_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem(SESSION_KEY, sessionId); } catch (e) {}
  }
  var visitorEmail = "";
  try { visitorEmail = localStorage.getItem(EMAIL_KEY) || ""; } catch (e) {}

  // ---------- Theme tokens ----------
  var THEMES = {
    light: {
      panelBg: "#ffffff",
      panelText: "#111827",
      headerText: "#ffffff",
      bubbleInbound: "#f3f4f6",
      bubbleInboundText: "#111827",
      border: "#e5e7eb",
      muted: "#6b7280",
      inputBg: "#ffffff",
    },
    dark: {
      panelBg: "#0f172a",
      panelText: "#f3f4f6",
      headerText: "#ffffff",
      bubbleInbound: "#1f2937",
      bubbleInboundText: "#f3f4f6",
      border: "#1f2937",
      muted: "#9ca3af",
      inputBg: "#0b1220",
    },
  };
  var t = THEMES[cfg.theme];

  // ---------- Inject CSS ----------
  // Use a unique prefix so we can't collide with host styles. Scoped resets
  // keep things sane without shadow DOM overhead.
  var styleEl = document.createElement("style");
  styleEl.setAttribute("data-ss-chat", "1");
  styleEl.textContent = [
    ".ss-chat-root,.ss-chat-root *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.4}",
    ".ss-chat-root{position:fixed;z-index:2147483600;" + (cfg.position === "bottom-left" ? "left:20px;" : "right:20px;") + "bottom:20px}",
    ".ss-chat-bubble{width:56px;height:56px;border-radius:50%;background:" + cfg.primary + ";color:#fff;border:none;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;transition:transform .15s ease}",
    ".ss-chat-bubble:hover{transform:translateY(-2px)}",
    ".ss-chat-bubble svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    ".ss-chat-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2)}",
    ".ss-chat-panel{position:absolute;bottom:72px;" + (cfg.position === "bottom-left" ? "left:0;" : "right:0;") + "width:380px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 100px);background:" + t.panelBg + ";color:" + t.panelText + ";border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,0.18);overflow:hidden;display:flex;flex-direction:column;border:1px solid " + t.border + "}",
    ".ss-chat-hidden{display:none!important}",
    ".ss-chat-header{background:" + cfg.primary + ";color:" + t.headerText + ";padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}",
    ".ss-chat-title{font-weight:600;font-size:15px;margin:0}",
    ".ss-chat-sub{font-size:12px;opacity:.85;margin:2px 0 0}",
    ".ss-chat-close{background:transparent;border:none;color:" + t.headerText + ";cursor:pointer;padding:4px;border-radius:6px;opacity:.85}",
    ".ss-chat-close:hover{opacity:1;background:rgba(255,255,255,.12)}",
    ".ss-chat-close svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    ".ss-chat-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:" + t.panelBg + "}",
    ".ss-chat-row{display:flex;max-width:80%}",
    ".ss-chat-row.ss-in{align-self:flex-start}",
    ".ss-chat-row.ss-out{align-self:flex-end}",
    ".ss-chat-bubble-msg{padding:9px 13px;border-radius:14px;font-size:14px;white-space:pre-wrap;word-wrap:break-word}",
    ".ss-chat-row.ss-in .ss-chat-bubble-msg{background:" + t.bubbleInbound + ";color:" + t.bubbleInboundText + ";border-bottom-left-radius:4px}",
    ".ss-chat-row.ss-out .ss-chat-bubble-msg{background:" + cfg.primary + ";color:#fff;border-bottom-right-radius:4px}",
    ".ss-chat-meta{font-size:11px;color:" + t.muted + ";margin-top:4px;padding:0 2px}",
    ".ss-chat-form{border-top:1px solid " + t.border + ";padding:10px;display:flex;gap:8px;align-items:flex-end;background:" + t.panelBg + ";flex-shrink:0}",
    ".ss-chat-input{flex:1;resize:none;border:1px solid " + t.border + ";border-radius:8px;padding:8px 10px;font-size:14px;background:" + t.inputBg + ";color:" + t.panelText + ";outline:none;max-height:96px;font-family:inherit}",
    ".ss-chat-input:focus{border-color:" + cfg.primary + "}",
    ".ss-chat-send{background:" + cfg.primary + ";color:#fff;border:none;border-radius:8px;width:38px;height:38px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}",
    ".ss-chat-send:disabled{opacity:.5;cursor:not-allowed}",
    ".ss-chat-send svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    ".ss-chat-email{padding:12px 16px;border-bottom:1px solid " + t.border + ";background:" + t.panelBg + "}",
    ".ss-chat-email label{display:block;font-size:12px;color:" + t.muted + ";margin-bottom:6px}",
    ".ss-chat-email input{width:100%;padding:8px 10px;font-size:13px;border:1px solid " + t.border + ";border-radius:6px;background:" + t.inputBg + ";color:" + t.panelText + ";outline:none;font-family:inherit}",
    ".ss-chat-email input:focus{border-color:" + cfg.primary + "}",
    ".ss-chat-brand{text-align:center;padding:6px 0 10px;font-size:11px;color:" + t.muted + ";flex-shrink:0;background:" + t.panelBg + "}",
    ".ss-chat-brand a{color:" + t.muted + ";text-decoration:none}",
    ".ss-chat-brand a:hover{text-decoration:underline}",
    "@media (max-width:440px){.ss-chat-panel{width:calc(100vw - 24px);height:calc(100vh - 100px);max-height:560px}}",
  ].join("");
  (document.head || document.documentElement).appendChild(styleEl);

  // ---------- Build DOM ----------
  var root = document.createElement("div");
  root.className = "ss-chat-root";

  var bubble = document.createElement("button");
  bubble.className = "ss-chat-bubble";
  bubble.setAttribute("aria-label", "Open chat");
  bubble.innerHTML =
    '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var badge = document.createElement("span");
  badge.className = "ss-chat-badge ss-chat-hidden";
  badge.textContent = "";
  bubble.appendChild(badge);

  var panel = document.createElement("div");
  panel.className = "ss-chat-panel ss-chat-hidden";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", cfg.name);

  // Header
  var header = document.createElement("div");
  header.className = "ss-chat-header";
  var htitle = document.createElement("div");
  htitle.innerHTML =
    '<p class="ss-chat-title"></p><p class="ss-chat-sub">We typically reply in a few minutes</p>';
  htitle.querySelector(".ss-chat-title").textContent = cfg.name;
  var closeBtn = document.createElement("button");
  closeBtn.className = "ss-chat-close";
  closeBtn.setAttribute("aria-label", "Close chat");
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  header.appendChild(htitle);
  header.appendChild(closeBtn);

  // Optional email capture row (shown until we have one)
  var emailRow = document.createElement("div");
  emailRow.className = "ss-chat-email";
  emailRow.innerHTML =
    '<label for="ss-chat-email-input">What\'s your email so we can follow up?</label>' +
    '<input id="ss-chat-email-input" type="email" autocomplete="email" placeholder="you@example.com" />';
  var emailInput = emailRow.querySelector("input");

  // Message list
  var body = document.createElement("div");
  body.className = "ss-chat-body";

  // Composer
  var form = document.createElement("form");
  form.className = "ss-chat-form";
  form.setAttribute("novalidate", "novalidate");
  var ta = document.createElement("textarea");
  ta.className = "ss-chat-input";
  ta.setAttribute("rows", "1");
  ta.setAttribute("placeholder", "Type a message…");
  ta.setAttribute("aria-label", "Message");
  var sendBtn = document.createElement("button");
  sendBtn.className = "ss-chat-send";
  sendBtn.type = "submit";
  sendBtn.setAttribute("aria-label", "Send message");
  sendBtn.innerHTML = '<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  form.appendChild(ta);
  form.appendChild(sendBtn);

  var brand = document.createElement("div");
  brand.className = "ss-chat-brand";
  brand.innerHTML =
    'Powered by <a href="' + ORIGIN + '" target="_blank" rel="noopener">ShortStack</a>';

  panel.appendChild(header);
  if (!visitorEmail) panel.appendChild(emailRow);
  panel.appendChild(body);
  panel.appendChild(form);
  panel.appendChild(brand);

  root.appendChild(panel);
  root.appendChild(bubble);
  document.body.appendChild(root);

  // ---------- State ----------
  var messages = []; // { id, direction: "inbound"|"outbound", body, sent_at }
  var seenIds = Object.create(null);
  var pollTimer = null;
  var lastSeenIso = ""; // ISO timestamp of the most recent message we've rendered
  var isOpen = false;
  var unread = 0;

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderMessage(m) {
    if (!m || !m.id || seenIds[m.id]) return;
    seenIds[m.id] = 1;
    messages.push(m);
    var row = document.createElement("div");
    row.className = "ss-chat-row " + (m.direction === "outbound" ? "ss-out" : "ss-in");
    var bub = document.createElement("div");
    bub.className = "ss-chat-bubble-msg";
    bub.textContent = m.body || "";
    row.appendChild(bub);
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
    if (m.sent_at && (!lastSeenIso || m.sent_at > lastSeenIso)) {
      lastSeenIso = m.sent_at;
    }
    if (m.direction === "inbound" && !isOpen) {
      unread++;
      badge.textContent = unread > 9 ? "9+" : String(unread);
      badge.classList.remove("ss-chat-hidden");
    }
  }

  function seedGreeting() {
    if (messages.length > 0) return;
    renderMessage({
      id: "greet",
      direction: "inbound",
      body: cfg.greeting,
      sent_at: new Date().toISOString(),
    });
    // A seeded greeting shouldn't count as unread.
    unread = 0;
    badge.classList.add("ss-chat-hidden");
  }

  // ---------- Network ----------
  // NOTE: in the widget's perspective, inbound === "from the agent/owner",
  // outbound === "sent by the visitor". The backend uses opposite semantics
  // (from the agency's POV) — the widget flips direction before rendering.
  function directionForWidget(serverDirection) {
    // Server: "inbound" = from visitor, "outbound" = from agent.
    return serverDirection === "outbound" ? "inbound" : "outbound";
  }

  function apiSend(text) {
    return fetch(ORIGIN + "/api/widget/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: TOKEN,
        sessionId: sessionId,
        message: text,
        visitorEmail: visitorEmail || undefined,
        pageUrl: location.href,
      }),
    }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }

  function apiPoll() {
    var url = ORIGIN + "/api/widget/chat?token=" + encodeURIComponent(TOKEN) +
      "&sessionId=" + encodeURIComponent(sessionId) +
      (lastSeenIso ? "&since=" + encodeURIComponent(lastSeenIso) : "");
    return fetch(url, { method: "GET" }).then(function (r) {
      return r.json().catch(function () { return { messages: [] }; });
    });
  }

  function startPolling() {
    if (pollTimer) return;
    // Light polling — 10s is enough for a conversational cadence and keeps
    // server cost manageable.
    pollTimer = setInterval(function () {
      apiPoll().then(function (res) {
        var arr = (res && res.messages) || [];
        for (var i = 0; i < arr.length; i++) {
          var m = arr[i];
          renderMessage({
            id: m.id,
            direction: directionForWidget(m.direction),
            body: m.body,
            sent_at: m.sent_at,
          });
        }
      }).catch(function () { /* swallow — next tick retries */ });
    }, 10000);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ---------- UI wiring ----------
  function open() {
    panel.classList.remove("ss-chat-hidden");
    bubble.setAttribute("aria-label", "Close chat");
    isOpen = true;
    unread = 0;
    badge.classList.add("ss-chat-hidden");
    seedGreeting();
    startPolling();
    // Immediate catch-up poll so users don't wait 10s for fresh messages.
    apiPoll().then(function (res) {
      var arr = (res && res.messages) || [];
      arr.forEach(function (m) {
        renderMessage({
          id: m.id,
          direction: directionForWidget(m.direction),
          body: m.body,
          sent_at: m.sent_at,
        });
      });
    }).catch(function () {});
    setTimeout(function () {
      try { ta.focus(); } catch (e) {}
    }, 50);
  }

  function close() {
    panel.classList.add("ss-chat-hidden");
    bubble.setAttribute("aria-label", "Open chat");
    isOpen = false;
  }

  function toggle() { isOpen ? close() : open(); }

  bubble.addEventListener("click", toggle);
  closeBtn.addEventListener("click", close);

  if (emailInput) {
    emailInput.addEventListener("change", function () {
      var v = (emailInput.value || "").trim();
      if (v && /.+@.+\..+/.test(v)) {
        visitorEmail = v;
        try { localStorage.setItem(EMAIL_KEY, v); } catch (e) {}
        emailRow.classList.add("ss-chat-hidden");
      }
    });
  }

  function submit() {
    var text = (ta.value || "").trim();
    if (!text) return;
    // Optimistic render — show the user's line immediately.
    renderMessage({
      id: "local_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      direction: "outbound",
      body: text,
      sent_at: new Date().toISOString(),
    });
    ta.value = "";
    sendBtn.disabled = true;
    apiSend(text).then(function (res) {
      sendBtn.disabled = false;
      if (res && res.error) {
        renderMessage({
          id: "err_" + Date.now(),
          direction: "inbound",
          body: "Sorry — we couldn't deliver that. Please try again in a moment.",
          sent_at: new Date().toISOString(),
        });
      }
    }).catch(function () {
      sendBtn.disabled = false;
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    submit();
  });
  ta.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  });
  // Auto-resize the textarea up to the CSS cap.
  ta.addEventListener("input", function () {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 96) + "px";
  });

  // ---------- Config endpoint (non-blocking) ----------
  // Lets the dashboard override theme/greeting/name per hub without the
  // customer needing to change their embed script. Fails quietly if the
  // endpoint is missing.
  try {
    fetch(ORIGIN + "/api/widget/config?token=" + encodeURIComponent(TOKEN))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        if (data.name) {
          cfg.name = data.name;
          var tEl = header.querySelector(".ss-chat-title");
          if (tEl) tEl.textContent = cfg.name;
          panel.setAttribute("aria-label", cfg.name);
        }
        if (data.greeting) cfg.greeting = data.greeting;
      })
      .catch(function () {});
  } catch (e) {}

  // ---------- Public API ----------
  window.ShortStackChat = {
    open: open,
    close: close,
    toggle: toggle,
    destroy: function () {
      stopPolling();
      try { root.parentNode && root.parentNode.removeChild(root); } catch (e) {}
      try { styleEl.parentNode && styleEl.parentNode.removeChild(styleEl); } catch (e) {}
      delete window.ShortStackChat;
    },
  };
})();
