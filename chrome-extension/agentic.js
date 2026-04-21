/* ShortStack OS — Agentic Content Script
 *
 * Foundational browser-control primitives exposed to the background
 * service worker (and through it, to the ShortStack backend over the
 * extension-bridge WebSocket).
 *
 * Design:
 *   - Command-handler map keyed by action name (`getDom`, `click`,
 *     `type`, `screenshot`, `focus`, `scrollTo`, `getSelection`,
 *     `getFormValues`, `keypress`, `getMeta`).
 *   - Each handler returns a plain object that can be JSON-serialized
 *     back across the message bus.
 *   - All handlers are best-effort — if a selector doesn't match, we
 *     return { ok: false, error } rather than throw.
 *   - Screenshot is handled by the background (requires
 *     chrome.tabs.captureVisibleTab) so we just acknowledge + let the
 *     background worker do the capture.
 *
 * This script runs on <all_urls> alongside content.js. It registers a
 * second chrome.runtime.onMessage listener with a namespaced `type` of
 * "SS_AGENTIC" so it never clashes with the legacy EXTRACT_PAGE flow.
 */
(() => {
  if (window.__shortstackAgenticLoaded) return;
  window.__shortstackAgenticLoaded = true;

  /* ── Selector utilities ── */
  function $find(selector) {
    if (!selector || typeof selector !== "string") return null;
    try {
      return document.querySelector(selector);
    } catch (e) {
      return null;
    }
  }

  function describeElement(el) {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName?.toLowerCase() || "",
      id: el.id || "",
      classes: (el.className && typeof el.className === "string") ? el.className.split(/\s+/).filter(Boolean) : [],
      text: (el.textContent || "").trim().slice(0, 200),
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      visible: rect.width > 0 && rect.height > 0,
      attrs: collectAttrs(el),
    };
  }

  function collectAttrs(el) {
    const out = {};
    if (!el.attributes) return out;
    for (const a of el.attributes) {
      // Skip the giant ones — style, class handled separately
      if (a.name === "style" || a.name === "class") continue;
      out[a.name] = String(a.value).slice(0, 300);
    }
    return out;
  }

  /* ── DOM snapshot ── */
  function getDom(args = {}) {
    const { maxChars = 50000, includeHidden = false } = args;
    // Clone and strip scripts/styles so the agent doesn't see hostile
    // code when asking for a snapshot.
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll("script, style, noscript, link[rel='stylesheet']").forEach((n) => n.remove());
    let html = clone.outerHTML || "";
    if (!includeHidden) {
      // Cheap pass — real "visible text" extraction is agent-side
      html = html.replace(/<!--[\s\S]*?-->/g, "");
    }
    return {
      ok: true,
      url: location.href,
      title: document.title,
      html: html.slice(0, maxChars),
      truncated: html.length > maxChars,
      length: html.length,
    };
  }

  /* ── Interactive-element inventory ──
   * Returns a compact list of things the agent can click/type into,
   * so it doesn't need to parse raw HTML. Each entry has a stable-ish
   * selector the agent can feed back to `click` / `type` / `focus`.
   */
  function getInteractive(args = {}) {
    const { limit = 100 } = args;
    const selectors = [
      "a[href]",
      "button",
      "input:not([type=hidden])",
      "textarea",
      "select",
      "[role=button]",
      "[role=link]",
      "[role=textbox]",
      "[onclick]",
      "[tabindex]:not([tabindex='-1'])",
    ];
    const seen = new Set();
    const out = [];
    for (const sel of selectors) {
      const nodes = document.querySelectorAll(sel);
      for (const el of nodes) {
        if (seen.has(el)) continue;
        seen.add(el);
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        out.push({
          selector: buildSelector(el),
          ...describeElement(el),
        });
        if (out.length >= limit) return { ok: true, count: out.length, items: out };
      }
    }
    return { ok: true, count: out.length, items: out };
  }

  // Build a "good enough" unique-ish selector. Not bulletproof but
  // doesn't require adding a 3rd-party dep like finder.js.
  function buildSelector(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 5) {
      let part = cur.tagName.toLowerCase();
      if (cur.classList && cur.classList.length) {
        part += "." + Array.from(cur.classList).slice(0, 2).map((c) => CSS.escape(c)).join(".");
      }
      // Add nth-of-type for stability when siblings share tag/class
      const parent = cur.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
        if (sameTag.length > 1) {
          const idx = sameTag.indexOf(cur) + 1;
          part += `:nth-of-type(${idx})`;
        }
      }
      parts.unshift(part);
      cur = cur.parentElement;
      if (cur === document.documentElement) break;
    }
    return parts.join(" > ");
  }

  /* ── Click ── */
  function click(args = {}) {
    const { selector, button = "left" } = args;
    const el = $find(selector);
    if (!el) return { ok: false, error: `No element for selector: ${selector}` };
    try {
      el.scrollIntoView({ block: "center", behavior: "instant" });
      const rect = el.getBoundingClientRect();
      const evtInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        button: button === "right" ? 2 : button === "middle" ? 1 : 0,
        clientX: rect.x + rect.width / 2,
        clientY: rect.y + rect.height / 2,
      };
      el.dispatchEvent(new MouseEvent("mousedown", evtInit));
      el.dispatchEvent(new MouseEvent("mouseup", evtInit));
      el.dispatchEvent(new MouseEvent("click", evtInit));
      return { ok: true, clicked: describeElement(el) };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  /* ── Type ── */
  function type(args = {}) {
    const { selector, text = "", replace = false } = args;
    const el = selector ? $find(selector) : document.activeElement;
    if (!el) return { ok: false, error: "No target element for type()" };
    try {
      el.focus();
      if ("value" in el) {
        // Input / textarea — use setter + input event so React/Vue pick it up
        const proto = Object.getPrototypeOf(el);
        const desc = Object.getOwnPropertyDescriptor(proto, "value");
        const setter = desc?.set;
        const newVal = replace ? text : (el.value || "") + text;
        if (setter) setter.call(el, newVal);
        else el.value = newVal;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (el.isContentEditable) {
        if (replace) el.textContent = text;
        else el.textContent = (el.textContent || "") + text;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
      } else {
        return { ok: false, error: "Element isn't an input/textarea/contenteditable" };
      }
      return { ok: true, value: el.value ?? el.textContent };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  /* ── Focus ── */
  function focus(args = {}) {
    const { selector } = args;
    const el = $find(selector);
    if (!el) return { ok: false, error: `No element for selector: ${selector}` };
    el.focus();
    return { ok: true };
  }

  /* ── Scroll ── */
  function scrollTo(args = {}) {
    const { selector, x, y, behavior = "instant" } = args;
    if (selector) {
      const el = $find(selector);
      if (!el) return { ok: false, error: `No element for selector: ${selector}` };
      el.scrollIntoView({ block: "center", behavior });
      return { ok: true, scrolledTo: selector };
    }
    window.scrollTo({ left: x || 0, top: y || 0, behavior });
    return { ok: true, x: window.scrollX, y: window.scrollY };
  }

  /* ── Keyboard shortcut ──
   * Synthesize a keydown/keyup on the focused (or target) element. Real
   * hotkey simulation across OS shortcuts requires the debugger API —
   * we scaffold the hook here, covering basic app shortcuts.
   */
  function keypress(args = {}) {
    const { selector, key, code, ctrlKey = false, shiftKey = false, altKey = false, metaKey = false } = args;
    const el = selector ? $find(selector) : (document.activeElement || document.body);
    if (!el) return { ok: false, error: "No target for keypress" };
    const init = { key, code: code || key, bubbles: true, cancelable: true, ctrlKey, shiftKey, altKey, metaKey };
    el.dispatchEvent(new KeyboardEvent("keydown", init));
    el.dispatchEvent(new KeyboardEvent("keypress", init));
    el.dispatchEvent(new KeyboardEvent("keyup", init));
    return { ok: true };
  }

  /* ── Selection ── */
  function getSelection() {
    const sel = window.getSelection();
    const text = sel ? sel.toString() : "";
    let anchorInfo = null;
    if (sel && sel.anchorNode) {
      const el = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      anchorInfo = el ? describeElement(el) : null;
    }
    return { ok: true, text, anchor: anchorInfo };
  }

  /* ── Form values ──
   * Snapshot every input/textarea/select value on the page. Passwords
   * are masked — the agent should never be shown those.
   */
  function getFormValues() {
    const out = [];
    document.querySelectorAll("input, textarea, select").forEach((el) => {
      const type = (el.type || el.tagName).toLowerCase();
      out.push({
        selector: buildSelector(el),
        name: el.name || el.id || "",
        type,
        value: type === "password" ? "[masked]" : (el.value || ""),
        placeholder: el.placeholder || "",
        required: !!el.required,
      });
    });
    return { ok: true, count: out.length, fields: out };
  }

  /* ── Page metadata ── */
  function getMeta() {
    return {
      ok: true,
      url: location.href,
      origin: location.origin,
      host: location.host,
      path: location.pathname,
      title: document.title,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      scroll: { x: window.scrollX, y: window.scrollY },
      docSize: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
      readyState: document.readyState,
      now: Date.now(),
    };
  }

  /* ── Handler registry ── */
  const HANDLERS = {
    getDom,
    getInteractive,
    click,
    type,
    focus,
    scrollTo,
    keypress,
    getSelection,
    getFormValues,
    getMeta,
  };

  /* ── Message bridge ──
   * The background worker sends `{ type: "SS_AGENTIC", action, args }`
   * here; we dispatch + respond. Messages without the SS_AGENTIC type
   * are ignored so we don't collide with the legacy EXTRACT_PAGE flow.
   */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== "SS_AGENTIC") return false;
    const handler = HANDLERS[msg.action];
    if (!handler) {
      sendResponse({ ok: false, error: `Unknown agentic action: ${msg.action}` });
      return true;
    }
    // Handlers are synchronous today but we wrap in Promise.resolve so
    // future async ones (e.g. wait-for-element) plug in cleanly.
    Promise.resolve()
      .then(() => handler(msg.args || {}))
      .then((res) => sendResponse(res))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  });

  // Mark the page so the ShortStack backend can detect agentic capability
  document.documentElement.setAttribute("data-shortstack-agentic", "1");
})();
