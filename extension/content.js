/**
 * ShortStack OS — Content Script
 * Runs on all pages to extract page context and provide browser interaction.
 */

// Listen for messages from background/sidepanel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "EXTRACT_PAGE") {
    const pageData = extractPageContext();
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
      if (el) {
        el.click();
        sendResponse({ success: true });
      } else {
        sendResponse({ error: "Element not found" });
      }
    } catch (e) {
      sendResponse({ error: String(e) });
    }
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
      } else {
        sendResponse({ error: "Element not found" });
      }
    } catch (e) {
      sendResponse({ error: String(e) });
    }
    return true;
  }

  if (msg.type === "SCROLL_TO") {
    try {
      const el = document.querySelector(msg.selector);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        sendResponse({ success: true });
      } else {
        window.scrollTo({ top: msg.y || 0, behavior: "smooth" });
        sendResponse({ success: true });
      }
    } catch (e) {
      sendResponse({ error: String(e) });
    }
    return true;
  }
});

function extractPageContext() {
  const title = document.title;
  const url = window.location.href;
  const metaDesc =
    document.querySelector('meta[name="description"]')?.getAttribute("content") || "";

  // Get visible text (truncated)
  const bodyText = document.body?.innerText?.slice(0, 3000) || "";

  // Get all links
  const links = Array.from(document.querySelectorAll("a[href]"))
    .slice(0, 20)
    .map((a) => ({ text: a.textContent?.trim().slice(0, 50), href: a.href }));

  // Get form fields
  const inputs = Array.from(document.querySelectorAll("input, textarea, select"))
    .slice(0, 20)
    .map((el) => ({
      type: el.type || el.tagName.toLowerCase(),
      name: el.name || el.id || "",
      placeholder: el.placeholder || "",
      value: el.type === "password" ? "***" : (el.value || "").slice(0, 100),
    }));

  // Get headings structure
  const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
    .slice(0, 15)
    .map((h) => ({ level: h.tagName, text: h.textContent?.trim().slice(0, 80) }));

  return {
    title,
    url,
    metaDescription: metaDesc,
    bodyText,
    links,
    inputs,
    headings,
  };
}

function highlightElement(selector) {
  // Remove previous highlights
  document.querySelectorAll(".ss-highlight").forEach((el) => el.remove());

  try {
    const el = document.querySelector(selector);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.className = "ss-highlight";
    overlay.style.cssText = `
      position: fixed;
      top: ${rect.top - 4}px;
      left: ${rect.left - 4}px;
      width: ${rect.width + 8}px;
      height: ${rect.height + 8}px;
      border: 2px solid #C9A84C;
      border-radius: 6px;
      background: rgba(201, 168, 76, 0.08);
      pointer-events: none;
      z-index: 999999;
      transition: opacity 0.3s;
    `;
    document.body.appendChild(overlay);

    // Auto-remove after 3s
    setTimeout(() => {
      overlay.style.opacity = "0";
      setTimeout(() => overlay.remove(), 300);
    }, 3000);
  } catch {}
}
