# Nango setup — per-client OAuth aggregator

> Status: foundation PR in flight (`feat/nango-foundation`). This doc covers
> what's been wired in the Nango dashboard so far + the env vars needed for
> the SDK to talk to Nango.

## Why Nango

Before Nango, every new OAuth provider meant:
- DIY callback route under `/api/oauth/<provider>/callback`
- DIY token storage in `oauth_connections`
- Manual refresh-token plumbing
- Per-client Google verification (capped at 100 test users — blocked us
  hard once we passed ~50 active clients)

Nango wraps **700+ APIs** behind one connection model. Each tenant gets a
`connection_id` per integration; the SDK fetches a fresh access token on
demand and we never store credentials ourselves. Per-tenant isolation is
enforced by Nango's connection model — there is no "shared OAuth app
quota" wall.

## Pricing

- **Starter**: $50/mo for ~50 active connections, 700+ APIs, no rate limits.
- **Growth**: $250/mo for ~500 connections.
- The starter tier covers us through early agency client base. Upgrade
  trigger: > 50 paid clients with at least one Nango connection each.

## Integrations configured (dev environment)

| Integration ID  | Auth method | Scopes / notes |
|-----------------|-------------|----------------|
| `google-zanb`   | OAuth 2     | `userinfo.email`, `userinfo.profile`, `calendar`, `drive.file`, `gmail.send` |
| `facebook`      | OAuth 2     | `ads_management`, `ads_read`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management` |
| `apify`         | API key     | No scopes — user pastes their Apify token at connect time |

**Pending** (need additional work):
- LinkedIn — needs `LINKEDIN_CLIENT_ID/SECRET` from LinkedIn developer
  portal (we don't have a LinkedIn dev app yet).
- TikTok — needs a TikTok Business app (we don't have one yet).
- Google Ads (separate from Google) — currently uses the `google-zanb`
  OAuth client; will get its own integration with `https://www.googleapis.com/auth/adwords` scope.

## Required env vars

Add to **Vercel project → Settings → Environment Variables** (Production
+ Preview + Development):

| Name                              | Value                                  |
|-----------------------------------|----------------------------------------|
| `NANGO_SECRET_KEY`                | Server-only. From app.nango.dev → Environment Settings → "Secret Key". Starts with `sk_dev_...` (or `sk_prod_...` after switching env). |
| `NEXT_PUBLIC_NANGO_PUBLIC_KEY`    | Browser-safe. Same screen, "Public Key". |

Copy the values into Vercel — do not commit them to the repo.

## Required GCP / Meta config

Both providers require `https://api.nango.dev/oauth/callback` added to
their authorized redirect URIs:

### GCP (Google + Google Ads)
1. https://console.cloud.google.com/apis/credentials
2. Click your OAuth 2.0 Client ID (`249780782780-...apps.googleusercontent.com`)
3. Under **Authorized redirect URIs**, add: `https://api.nango.dev/oauth/callback`
4. Keep the existing entries (`https://app.shortstack.work/api/oauth/google/callback`
   etc) — we won't remove them until the Nango migration is verified in prod.
5. Save.

### Meta / Facebook
1. https://developers.facebook.com/apps/1886213135251493/
2. Sidebar → **Facebook Login** → **Settings**
3. Under **Valid OAuth Redirect URIs**, add: `https://api.nango.dev/oauth/callback`
4. Save.

### Apify
No redirect URI needed — uses API key auth.

## How a tenant connects an integration (once foundation lands)

```
1. User clicks "Connect Google" in Integrations Hub
2. We open the branded confirmation modal (logo + scope list + "Authorize")
3. On Authorize, frontend SDK launches Nango popup → Google OAuth
4. User signs in with their Google account (NOT ours)
5. Nango stores the credentials, fires webhook to /api/integrations/nango/webhook
6. We insert into oauth_connections_nango (user_id, integration_id, nango_connection_id)
7. Backend code calls getCredentials('google-zanb', `${user_id}-google-zanb`)
   to get a fresh access token whenever it needs to call Google APIs
```

The connection_id convention: `${user_id}-${integration_id}` (stable, one
connection per tenant per integration).

## Migration plan (DIY → Nango)

The foundation PR migrates **Google Ads OAuth only** as a proof-of-concept.
The old DIY routes stay running side-by-side so we can roll back. Once the
Nango path is verified in prod (1 week), we delete the DIY routes for that
provider and move on to the next.

| Provider       | DIY route                                 | Nango integration | Migration status |
|----------------|-------------------------------------------|-------------------|------------------|
| Google Ads     | `/api/oauth/google-ads/callback`          | `google-zanb`     | In foundation PR |
| Google (Workspace) | `/api/oauth/google/callback`          | `google-zanb`     | After Ads validates |
| Meta Ads       | `/api/integrations/meta-ads/callback`     | `facebook`        | Batch 2 |
| Apify          | (was DIY API key form)                    | `apify`           | Batch 2 |
| LinkedIn       | (none)                                    | LinkedIn (TODO)   | Need dev app |
| TikTok         | (none)                                    | TikTok (TODO)     | Need business app |

## Cost & quota notes

- Each user connection = 1 quota slot on Nango (not per-API-call).
- Disconnecting a user frees the slot.
- Background sync workers (`syncs` in Nango) are NOT enabled — we make
  on-demand calls via `getCredentials()`. If we later want continuous data
  sync (e.g. nightly Google Ads spend pull), enabling syncs adds cost per
  per-sync run.

## Operational pointers

- **Nango logs**: app.nango.dev → Logs (every connect / refresh / API call
  funneled through Nango shows here, indispensable for debugging).
- **Webhook secret**: configure under Environment Settings; we'll wire
  this in batch 2 to make webhook delivery fail-closed.
- **Production cutover**: switch from `dev` env to `prod` env in Nango +
  swap `NANGO_SECRET_KEY` to the `sk_prod_...` value. Do NOT mix dev +
  prod keys across environments.
