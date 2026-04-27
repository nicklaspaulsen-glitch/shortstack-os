import type { ProspectData } from "../shared/types";
import { extractProspect } from "./scrape";

// ─── Content script ──────────────────────────────────────────────────
// LinkedIn is a Single Page App, so the URL changes without a full page
// load. We watch the URL and re-render the floating button whenever the
// user navigates between profiles.
//
// NEVER import any heavy dependencies here — content scripts run on
// every page load and bundling React would balloon LinkedIn's already
// heavy memory footprint. This file is intentionally vanilla DOM.

const FLOATING_BUTTON_ID = "shortstack-prospector-fab";
const TOAST_ID = "shortstack-prospector-toast";

// Profile URL pattern: linkedin.com/in/<handle> with optional trailing path
const PROFILE_PATH_RE = /^\/in\/[^/]+/;

function isOnProfile(): boolean {
  return PROFILE_PATH_RE.test(window.location.pathname);
}

function removeFloatingButton(): void {
  document.getElementById(FLOATING_BUTTON_ID)?.remove();
}

function showToast(message: string, kind: "success" | "error" = "success"): void {
  document.getElementById(TOAST_ID)?.remove();
  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.className = `shortstack-toast shortstack-toast-${kind}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  // Auto-dismiss
  window.setTimeout(() => {
    toast.classList.add("shortstack-toast-fade");
    window.setTimeout(() => toast.remove(), 300);
  }, 2800);
}

async function handleSaveClick(): Promise<void> {
  const data = extractProspect();
  if (!data || !data.fullName) {
    showToast("Could not detect prospect on this page.", "error");
    return;
  }

  const button = document.getElementById(FLOATING_BUTTON_ID);
  if (button) {
    button.setAttribute("disabled", "true");
    button.textContent = "Saving…";
  }

  try {
    const response: unknown = await chrome.runtime.sendMessage({
      type: "SAVE_LEAD",
      payload: {
        business_name: data.company || data.fullName,
        name: data.fullName,
        email: null,
        phone: null,
        website: null,
        industry: null,
        source_url: data.linkedinUrl,
        detected_from: "linkedin_profile",
        headline: data.headline,
        role: data.role,
        location: data.location,
        profile_image_url: data.profileImageUrl,
      },
    });

    if (response && typeof response === "object" && "ok" in response) {
      const r = response as { ok: boolean; error?: string };
      if (r.ok) {
        showToast("Saved to ShortStack CRM.", "success");
      } else {
        showToast(r.error ?? "Save failed", "error");
      }
    } else {
      showToast("Unexpected response from extension", "error");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    showToast(msg, "error");
  } finally {
    if (button) {
      button.removeAttribute("disabled");
      button.textContent = "Save to ShortStack";
    }
  }
}

function ensureFloatingButton(): void {
  if (!isOnProfile()) {
    removeFloatingButton();
    return;
  }
  if (document.getElementById(FLOATING_BUTTON_ID)) return;

  const button = document.createElement("button");
  button.id = FLOATING_BUTTON_ID;
  button.className = "shortstack-fab";
  button.type = "button";
  button.setAttribute("aria-label", "Save prospect to ShortStack");
  button.textContent = "Save to ShortStack";
  button.addEventListener("click", () => {
    void handleSaveClick();
  });
  document.body.appendChild(button);
}

// LinkedIn navigates without reloading; observe URL changes.
let lastPath = "";
function onPossibleNav(): void {
  if (window.location.pathname === lastPath) return;
  lastPath = window.location.pathname;
  // Wait a tick for LinkedIn to render the new page.
  window.setTimeout(ensureFloatingButton, 800);
}

const observer = new MutationObserver(onPossibleNav);
observer.observe(document.body, { childList: true, subtree: true });

// Initial render
window.addEventListener("load", ensureFloatingButton);
ensureFloatingButton();

// ─── Popup → content script bridge ───────────────────────────────────
// The popup asks for the currently-detected prospect via the background
// SW; we just respond with whatever we can scrape from the DOM.
chrome.runtime.onMessage.addListener((rawMsg, _sender, sendResponse) => {
  const msg = rawMsg as { type?: string };
  if (msg.type === "EXTRACT_PROSPECT") {
    const data: ProspectData | null = isOnProfile() ? extractProspect() : null;
    sendResponse(data);
    return true;
  }
  return false;
});
