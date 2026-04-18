# Chrome Extension — Manual Testing Checklist

This is the launch-blocker testing path for the ShortStack OS Chrome extension after the auth + persistence overhaul.

## 1. Load the extension locally

1. Build and run the Next.js app (`npm run dev` on port 3000 or deploy to `app.shortstack.work`).
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and pick the `chrome-extension/` folder at the repo root.
5. Pin the ShortStack icon from the puzzle-piece menu to the toolbar.

Expected result: extension icon visible, clicking it opens the popup with the auth gate.

### Local dev gotcha
The manifest no longer lists `http://localhost:3000/*` as a host. For dev against localhost, either:
- Add `"http://localhost:3000/*"` back to `host_permissions` and `externally_connectable.matches` in your local copy of `manifest.json`, OR
- Set `baseUrl` to `http://localhost:3000` inside the popup Settings → Advanced → Instance URL.

## 2. Log in via the new handshake

1. Click the **Log in with ShortStack** button in the popup.
2. A new tab opens at `/extension-auth?ext_id=<your-extension-id>`.
3. If you're not signed in, the page redirects to `/login?redirect=/extension-auth?ext_id=...`. Sign in there.
4. After login, the page shows "Connecting ShortStack Extension" briefly, then "Extension connected! You can close this tab." and auto-closes.
5. Re-open the popup. Status dot should be green, main UI should be visible.

Behind the scenes:
- `POST /api/extension/generate-token` returns your Supabase `access_token` + `refresh_token`.
- The page calls `chrome.runtime.sendMessage(ext_id, { type: "SHORTSTACK_AUTH_TOKEN", payload: ... })`.
- `background.js` receives the message via `chrome.runtime.onMessageExternal` and stores the tokens in `chrome.storage.local` (never `chrome.storage.sync` — tokens must stay local to this device).

## 3. Test cases

### Save a lead
1. In the popup, click **Add Lead**.
2. Fill in Business Name, Email, Phone. Submit.
3. Expected: inline form closes, Recent Activity shows "addLead — <your business name>".

Verify in Supabase:
```sql
select id, user_id, business_name, email, phone, source, source_url, metadata, created_at
from leads
where source = 'chrome_extension'
order by created_at desc
limit 5;
```
You should see the row with `user_id = <your auth uid>`, `source = chrome_extension`, and the URL you were browsing in `source_url`.

### Save a note
1. Select text on any page (at least 3 chars).
2. Selection toolbar appears above the selection — click **Note**.
3. Expected: activity log entry for `saveNote`.

Verify in Supabase:
```sql
select id, user_id, content, url, page_title, tags, created_at
from extension_notes
order by created_at desc
limit 5;
```
The RLS policy is `auth.uid() = user_id`. If you run the query as the Supabase service role you'll see all rows; as a regular user you'll only see your own.

You can also list your notes from the extension via `GET /api/extension/note?limit=20` (use the popup's devtools network tab).

### Chat with AI
1. In the popup, type a question in the chat input ("Summarize this page") and hit Enter.
2. Expected: typing indicator appears, response streams back within a few seconds.
3. Click a suggestion card (e.g. "SEO Audit") — it pre-fills a rich prompt and sends it automatically.

Verify rate limiting:
- Send 31 messages within a minute. The 31st should return HTTP 429 with `retryAfterSec` in the body.

### Summarize a page
1. From the popup, click **Summarize**.
2. Expected: the backend fetches the page HTML, passes it to Claude, and returns a 2-3 sentence summary.
3. Notification appears with the summary.

## 4. Verify auth is actually enforced

Pick any extension route and call it without a token:
```bash
curl -X POST https://app.shortstack.work/api/extension/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hi"}'
# expected: {"error":"Unauthorized"} HTTP 401
```

And with a bogus token:
```bash
curl -X POST https://app.shortstack.work/api/extension/note \
  -H "Authorization: Bearer not-a-real-token" \
  -H "Content-Type: application/json" \
  -d '{"content":"hi"}'
# expected: {"error":"Unauthorized: invalid or expired token"} HTTP 401
```

Before this overhaul these endpoints accepted *any* string starting with `Bearer `, which was the critical launch blocker.

## 5. Logout

Run `chrome.runtime.sendMessage({ action: "logout" })` from the popup devtools console (or clear `chrome.storage.local`) to confirm tokens are purged and the auth gate reappears on next popup open.
