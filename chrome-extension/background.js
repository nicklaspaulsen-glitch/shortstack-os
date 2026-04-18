/* ShortStack OS — Background Service Worker */
importScripts("api.js");

const AUTH_PAGE = "https://app.shortstack.work/extension-auth";

/* ── Context Menus ── */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "ss-add-lead", title: "Add as Lead", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "ss-create-post", title: "Create Post from Selection", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "ss-summarize", title: "Summarize Selection", contexts: ["selection"] });
  chrome.alarms.create("check-notifications", { periodInMinutes: 5 });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const text = info.selectionText || "";
  try {
    if (info.menuItemId === "ss-add-lead") {
      await addLead({ name: text, business_name: text, source: tab.url, detectedFrom: "context-menu" });
      notify("Lead Added", `"${text.slice(0, 40)}" saved as a new lead.`);
    } else if (info.menuItemId === "ss-create-post") {
      await createPost({ content: text, sourceUrl: tab.url });
      notify("Post Drafted", "Selection saved as a post draft.");
    } else if (info.menuItemId === "ss-summarize") {
      const res = await summarizePage(tab.url);
      notify("Summary Ready", res.summary ? res.summary.slice(0, 120) : "Summary generated.");
    }
    logActivity(info.menuItemId.replace("ss-", ""), text.slice(0, 60));
  } catch (e) {
    notify("ShortStack Error", e.message);
  }
});

/* ── Internal Message Router ── */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      let result;
      switch (msg.action) {
        case "addLead":      result = await addLead(msg.data); break;
        case "createPost":   result = await createPost(msg.data); break;
        case "summarize":    result = await summarizePage(msg.data.url); break;
        case "saveNote":     result = await saveNote(msg.data); break;
        case "trackCompetitor": result = await trackCompetitor(msg.data.url); break;
        case "getActivity":  result = await getActivity(); break;
        case "chatWithAI":   result = await chatWithAI(msg.data.message, msg.data.url, msg.data.pageContext); break;
        case "checkAuth":    result = await checkAuth(); break;
        case "startLogin":   result = await startLogin(); break;
        case "logout":       result = await logout(); break;
        default: result = { error: "Unknown action" };
      }
      if (!["getActivity", "checkAuth", "startLogin", "logout"].includes(msg.action)) {
        logActivity(msg.action, msg.label || "");
      }
      sendResponse({ ok: true, data: result });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();
  return true; // keep channel open for async
});

/* ── External Message Listener (for /extension-auth handshake) ── */
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  // Chrome validates sender.origin against externally_connectable in manifest,
  // so we can trust this message comes from one of our own origins.
  if (msg?.type !== "SHORTSTACK_AUTH_TOKEN" || !msg.payload?.access_token) {
    sendResponse({ ok: false });
    return;
  }
  const p = msg.payload;
  chrome.storage.local.set(
    {
      ss_access_token: p.access_token,
      ss_refresh_token: p.refresh_token || "",
      ss_expires_at: p.expires_at || 0,
      ss_user: p.user || null,
    },
    () => sendResponse({ ok: true }),
  );
  return true; // keep channel open for async storage call
});

/* ── Notifications ── */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "check-notifications") return;
  try {
    const res = await apiCall("/api/extension/notifications", "GET");
    const count = res.unread || 0;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#C9A84C" });
  } catch (_) { /* silent — likely not logged in */ }
});

function notify(title, message) {
  chrome.notifications.create({ type: "basic", iconUrl: "icons/icon128.png", title, message });
}

/* ── Activity Log ── */
async function logActivity(action, detail) {
  const { recentActivity = [] } = await chrome.storage.local.get("recentActivity");
  recentActivity.unshift({ action, detail, ts: Date.now() });
  await chrome.storage.local.set({ recentActivity: recentActivity.slice(0, 20) });
}

async function getActivity() {
  const { recentActivity = [] } = await chrome.storage.local.get("recentActivity");
  return recentActivity.slice(0, 5);
}

async function checkAuth() {
  const { accessToken, apiKey, user } = await getConfig();
  return { connected: !!(accessToken || apiKey), user };
}

async function startLogin() {
  // Open the handshake page with our extension id so the page can
  // postMessage the token back to us via chrome.runtime.sendMessage.
  const url = `${AUTH_PAGE}?ext_id=${chrome.runtime.id}`;
  chrome.tabs.create({ url });
  return { ok: true };
}

async function logout() {
  await chrome.storage.local.remove([
    "ss_access_token",
    "ss_refresh_token",
    "ss_expires_at",
    "ss_user",
  ]);
  return { ok: true };
}
