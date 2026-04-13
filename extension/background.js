/**
 * ShortStack OS — Chrome Extension Background Service Worker
 * Handles side panel, auth state, and message routing.
 */

const API_BASE = "https://shortstack-os.vercel.app";

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Set side panel behavior
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});

// Handle messages from content script and side panel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_AUTH") {
    chrome.storage.local.get(["ss_token", "ss_profile"], (data) => {
      sendResponse({
        token: data.ss_token || null,
        profile: data.ss_profile || null,
      });
    });
    return true;
  }

  if (msg.type === "SET_AUTH") {
    chrome.storage.local.set({
      ss_token: msg.token,
      ss_profile: msg.profile,
    });
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "LOGOUT") {
    chrome.storage.local.remove(["ss_token", "ss_profile"]);
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "AI_CHAT") {
    handleAIChat(msg.messages)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ error: String(err) }));
    return true;
  }

  if (msg.type === "GET_PAGE_CONTEXT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "EXTRACT_PAGE" }, (res) => {
          sendResponse(res || { error: "Could not extract page content" });
        });
      } else {
        sendResponse({ error: "No active tab" });
      }
    });
    return true;
  }
});

async function handleAIChat(messages) {
  try {
    const res = await fetch(`${API_BASE}/api/agents/client-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `API error ${res.status}: ${text}` };
    }

    return await res.json();
  } catch (err) {
    return { error: String(err) };
  }
}
