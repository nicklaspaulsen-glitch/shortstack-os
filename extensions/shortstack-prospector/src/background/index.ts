import { checkAuth, openLoginTab } from "./auth";
import { researchProspect, saveLead, searchLeads } from "./api";
import type {
  ApiResult,
  ExtensionMessage,
  LeadSummary,
  ResearchResult,
} from "../shared/types";

// ─── Service worker entry ────────────────────────────────────────────
// MV3 service workers are stateless — we re-read the auth cookie on
// every request and never cache the token in module state.

chrome.runtime.onInstalled.addListener(() => {
  console.info("[prospector] installed");
});

// Centralized message router. Returns `true` from the listener so Chrome
// keeps the channel open while the async handler resolves.
chrome.runtime.onMessage.addListener((rawMsg, _sender, sendResponse) => {
  const msg = rawMsg as ExtensionMessage;
  void handleMessage(msg)
    .then((result) => sendResponse(result))
    .catch((e: unknown) => {
      const error = e instanceof Error ? e.message : "Unexpected error";
      console.error("[prospector] dispatch error:", error);
      sendResponse({ ok: false, error } satisfies ApiResult<never>);
    });
  return true;
});

async function handleMessage(
  msg: ExtensionMessage,
): Promise<ApiResult<unknown>> {
  switch (msg.type) {
    case "CHECK_AUTH": {
      const auth = await checkAuth();
      return { ok: true, data: auth };
    }
    case "OPEN_LOGIN": {
      await openLoginTab();
      return { ok: true, data: null };
    }
    case "GET_PROSPECT": {
      // Forward to the active tab's content script. The content script
      // owns the LinkedIn DOM logic; the background SW just relays.
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) {
        return { ok: false, error: "No active tab" };
      }
      try {
        const response: unknown = await chrome.tabs.sendMessage(tab.id, {
          type: "EXTRACT_PROSPECT",
        });
        return { ok: true, data: response };
      } catch (e) {
        const error =
          e instanceof Error ? e.message : "Could not contact content script";
        return { ok: false, error };
      }
    }
    case "SAVE_LEAD": {
      const { id } = await saveLead(msg.payload);
      return { ok: true, data: { id } };
    }
    case "RESEARCH_PROSPECT": {
      const result: ResearchResult = await researchProspect(msg.payload);
      return { ok: true, data: result };
    }
    case "SEARCH_LEADS": {
      const leads: LeadSummary[] = await searchLeads(msg.payload.query);
      return { ok: true, data: leads };
    }
    default: {
      // Exhaustiveness check
      const _exhaust: never = msg;
      void _exhaust;
      return { ok: false, error: "Unknown message type" };
    }
  }
}
