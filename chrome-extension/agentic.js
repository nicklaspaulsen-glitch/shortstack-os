/* ShortStack OS — Agentic Content Script (v2)
 *
 * Foundational browser-control primitives exposed to the background
 * service worker (and through it, to the ShortStack backend over the
 * extension-bridge HTTPS long-poll transport).
 *
 * v2 additions on top of the original 10 handlers:
 *   - waitForSelector    (async DOM readiness polling)
 *   - waitForNavigation  (URL/readyState change detection on this frame)
 *   - execPlan           (sequential multi-step plan with fail-fast)
 *   - Optional `frameSelector` on click/type/focus/keypress/scrollTo to
 *     descend into a same-origin iframe before acting.
 *   - Error recovery: when click/type fails to find the target, we return
 *     a fresh interactive snapshot so the caller can re-plan.
 *
 * Cross-origin iframes still require background-side frameId routing
 * (bridge.js handles this side); same-origin iframes are driven entirely
 * from this content script via the `frameSelector` option.
 */
(() => {
  if (window.__shortstackAgenticLoaded) return;
  window.__shortstackAgenticLoaded = true;

  /* ── Selector utilities ── */
  function $find(selector, root) {
    if (!selector || typeof selector !== "string") return null;
    const scope = root || document;
    try {
      return scope.querySelector(selector);
    } catch (e) {
      return null;
    }
  }

  /**
   * Resolve a selector inside an optional iframe. For same-origin frames
   * we drill into contentDocument; for cross-origin we bail out with an
   * error that signals the bridge to re-route via frameId.
   */
  function resolveRoot(frameSelector) {
    if (!frameSelector) return { root: document };
    const frameEl = $find(frameSelector);
    if (!frameEl) return { error: "No iframe for selector: " + frameSelector };
    if (frameEl.tagName !== "IFRAME" && frameEl.tagName !== "FRAME") {
      return { error: "Element is not a frame: " + frameSelector };
    }
    let doc;
    try {
      doc = frameEl.contentDocument;
    } catch (e) {
      return { error: "cross_origin_frame", frame: frameSelector };
    }
    if (!doc) return { error: "cross_origin_frame", frame: frameSelector };
    return { root: doc, frame: frameEl };
  }

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    return true;
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
    const { limit = 100, frameSelector } = args;
    const r = resolveRoot(frameSelector);
    if (r.error) return { ok: false, error: r.error, frame: r.frame };
    const root = r.root;
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
      const nodes = root.querySelectorAll(sel);
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

  /* ── Recovery snapshot ──
   * Returned alongside errors when a click/type/focus couldn't find its
   * target, so the caller can re-plan without a round-trip.
   */
  function recoverySnapshot() {
    const inv = getInteractive({ limit: 40 });
    return {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      interactive: inv.items || [],
    };
  }

  /* ── Click ── */
  function click(args = {}) {
    const { selector, button = "left", frameSelector } = args;
    const r = resolveRoot(frameSelector);
    if (r.error) return { ok: false, error: r.error, frame: r.frame, recovery: recoverySnapshot() };
    const el = $find(selector, r.root);
    if (!el) return { ok: false, error: "No element for selector: " + selector, recovery: recoverySnapshot() };
    try {
      el.scrollIntoView({ block: "center", behavior: "instant" });
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return { ok: false, error: "Element is zero-sized / not visible", recovery: recoverySnapshot() };
      }
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
      return { ok: false, error: String(e), recovery: recoverySnapshot() };
    }
  }

  /* ── Type ── */
  function type(args = {}) {
    const { selector, text = "", replace = false, frameSelector } = args;
    const r = resolveRoot(frameSelector);
    if (r.error) return { ok: false, error: r.error, frame: r.frame, recovery: recoverySnapshot() };
    const el = selector ? $find(selector, r.root) : document.activeElement;
    if (!el) return { ok: false, error: "No target element for type()", recovery: recoverySnapshot() };
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
        return { ok: false, error: "Element isn't an input/textarea/contenteditable", recovery: recoverySnapshot() };
      }
      return { ok: true, value: el.value ?? el.textContent };
    } catch (e) {
      return { ok: false, error: String(e), recovery: recoverySnapshot() };
    }
  }

  /* ── Focus ── */
  function focus(args = {}) {
    const { selector, frameSelector } = args;
    const r = resolveRoot(frameSelector);
    if (r.error) return { ok: false, error: r.error, frame: r.frame };
    const el = $find(selector, r.root);
    if (!el) return { ok: false, error: "No element for selector: " + selector, recovery: recoverySnapshot() };
    el.focus();
    return { ok: true };
  }

  /* ── Scroll ── */
  function scrollTo(args = {}) {
    const { selector, x, y, behavior = "instant", frameSelector } = args;
    const r = resolveRoot(frameSelector);
    if (r.error) return { ok: false, error: r.error, frame: r.frame };
    if (selector) {
      const el = $find(selector, r.root);
      if (!el) return { ok: false, error: "No element for selector: " + selector };
      el.scrollIntoView({ block: "center", behavior });
      return { ok: true, scrolledTo: selector };
    }
    window.scrollTo({ left: x || 0, top: y || 0, behavior });
    return { ok: true, x: window.scrollX, y: window.scrollY };
  }

  /* ── Keyboard shortcut ── */
  function keypress(args = {}) {
    const { selector, key, code, ctrlKey = false, shiftKey = false, altKey = false, metaKey = false, frameSelector } = args;
    const r = resolveRoot(frameSelector);
    if (r.error) return { ok: false, error: r.error, frame: r.frame };
    const el = selector ? $find(selector, r.root) : (document.activeElement || document.body);
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
      const t = (el.type || el.tagName).toLowerCase();
      out.push({
        selector: buildSelector(el),
        name: el.name || el.id || "",
        type: t,
        value: t === "password" ? "[masked]" : (el.value || ""),
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

  /* ── waitForSelector ──
   * Poll up to `timeout` ms for a selector to exist AND be visible.
   * Default timeout: 10s. Default poll interval: 100ms.
   */
  function waitForSelector(args = {}) {
    const { selector, timeout = 10000, interval = 100, requireVisible = true, frameSelector } = args;
    if (!selector) return Promise.resolve({ ok: false, error: "Missing selector" });
    const start = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        const r = resolveRoot(frameSelector);
        if (r.error && r.error !== "cross_origin_frame") {
          return resolve({ ok: false, error: r.error });
        }
        const root = r.root || document;
        const el = $find(selector, root);
        if (el && (!requireVisible || isVisible(el))) {
          return resolve({ ok: true, waitedMs: Date.now() - start, element: describeElement(el) });
        }
        if (Date.now() - start >= timeout) {
          return resolve({ ok: false, error: "waitForSelector timed out after " + timeout + "ms", selector, recovery: recoverySnapshot() });
        }
        setTimeout(tick, interval);
      };
      tick();
    });
  }

  /* ── waitForNavigation ──
   * Wait for either the URL to change from the baseline or for the
   * document to transition to complete. Background-side listener in
   * bridge.js provides a stronger signal for cross-origin navigations.
   */
  function waitForNavigation(args = {}) {
    const { timeout = 15000, interval = 150, waitForLoadState = "complete" } = args;
    const start = Date.now();
    const startUrl = location.href;
    return new Promise((resolve) => {
      const tick = () => {
        const urlChanged = location.href !== startUrl;
        const readyOk = waitForLoadState === "any" || document.readyState === waitForLoadState || document.readyState === "complete";
        if (urlChanged && readyOk) {
          return resolve({ ok: true, waitedMs: Date.now() - start, url: location.href, readyState: document.readyState });
        }
        if (Date.now() - start >= timeout) {
          return resolve({
            ok: false,
            error: "waitForNavigation timed out after " + timeout + "ms",
            url: location.href,
            readyState: document.readyState,
            urlChanged,
          });
        }
        setTimeout(tick, interval);
      };
      tick();
    });
  }

  /* ── execPlan ──
   * Run a sequence of agentic steps in order. On any failure, short-circuit
   * and return per-step results up to and including the failure. Each step
   * supports `{ action, args, optional }` where `optional: true` lets a
   * single-step failure continue instead of aborting the plan.
   */
  async function execPlan(args = {}) {
    const { steps = [], stopOnError = true } = args;
    if (!Array.isArray(steps) || steps.length === 0) {
      return { ok: false, error: "execPlan requires steps[]" };
    }
    const results = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i] || {};
      const { action, args: stepArgs = {}, optional = false } = step;
      const handler = HANDLERS[action];
      if (!handler) {
        const res = { ok: false, error: "Unknown action in step " + i + ": " + action };
        results.push({ step: i, action, ...res });
        if (stopOnError && !optional) return { ok: false, failedAt: i, results };
        continue;
      }
      let res;
      try {
        res = await Promise.resolve(handler(stepArgs));
      } catch (e) {
        res = { ok: false, error: String(e) };
      }
      results.push({ step: i, action, ...res });
      if (!res.ok && stopOnError && !optional) {
        return { ok: false, failedAt: i, results };
      }
    }
    return { ok: true, steps: results.length, results };
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
    waitForSelector,
    waitForNavigation,
    execPlan,
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
  document.documentElement.setAttribute("data-shortstack-agentic", "2");
})();
