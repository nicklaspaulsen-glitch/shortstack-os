# ShortStack OS — Environment Variables Checklist

## Required (app will not work without these)

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous/public key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side admin operations)
- [ ] `NEXT_PUBLIC_APP_URL` — Deployed app URL (defaults to `https://shortstack-os.vercel.app`)
- [ ] `CRON_SECRET` — Secret used to authenticate cron job endpoints

## AI / LLM

- [ ] `ANTHROPIC_API_KEY` — Anthropic Claude API key (used across content generation, agents, outreach, reports, and more)
- [ ] `OPENAI_API_KEY` — OpenAI API key (agent generation, health check)

## GoHighLevel (GHL) — DEPRECATED Apr 21

Code no longer reads these env vars. Safe to remove from Vercel at your
convenience — keep them set only if a legacy webhook still posts to
`/api/webhooks/ghl` with `GHL_WEBHOOK_SECRET`.

- [x] ~~`GHL_API_KEY`~~ — replaced by Resend (email), Twilio (SMS), ElevenAgents (calls)
- [x] ~~`GHL_LOCATION_ID`~~
- [x] ~~`GHL_COMPANY_ID`~~
- [x] ~~`GHL_AGENCY_KEY`~~

## Telegram

- [ ] `TELEGRAM_BOT_TOKEN` — Telegram bot token (notifications, webhook commands, reminders)
- [ ] `TELEGRAM_CHAT_ID` — Default Telegram chat ID for notifications

## Stripe (Billing)

- [ ] `STRIPE_SECRET_KEY` — Stripe secret key (invoices, subscriptions, license validation)
- [ ] `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- [ ] `STRIPE_BILLING_WEBHOOK_SECRET` — Stripe billing-specific webhook secret (optional, falls back to `STRIPE_WEBHOOK_SECRET`)
- [ ] `STRIPE_PRICE_STARTER` — Stripe price ID for Starter tier (optional override; defaults to hardcoded prod ID in `/api/license/checkout`)
- [ ] `STRIPE_PRICE_GROWTH` — Stripe price ID for Growth tier (optional override)
- [ ] `STRIPE_PRICE_ENTERPRISE` — Stripe price ID for Enterprise tier (optional override)

## Social Media — Meta / Facebook / Instagram

- [ ] `META_APP_ID` — Meta (Facebook) app ID (OAuth)
- [ ] `META_APP_SECRET` — Meta app secret (token refresh, OAuth callback)
- [ ] `META_ACCESS_TOKEN` — Meta Graph API access token (outreach, lead scraping, social posts)
- [ ] `META_ADS_ACCESS_TOKEN` — Meta Ads access token (ad campaigns health check)

## Social Media — TikTok

- [ ] `TIKTOK_CLIENT_KEY` — TikTok app client key (OAuth)
- [ ] `TIKTOK_CLIENT_SECRET` — TikTok app client secret (OAuth callback)
- [ ] `TIKTOK_ACCESS_TOKEN` — TikTok API access token (outreach, posting)
- [ ] `TIKTOK_ADS_ACCESS_TOKEN` — TikTok Ads access token (health check)

## Social Media — LinkedIn

- [ ] `LINKEDIN_CLIENT_ID` — LinkedIn app client ID (OAuth)
- [ ] `LINKEDIN_CLIENT_SECRET` — LinkedIn app client secret (OAuth callback)
- [ ] `LINKEDIN_ACCESS_TOKEN` — LinkedIn API access token (outreach, posting)

## Google APIs

- [ ] `GOOGLE_CLIENT_ID` — Google OAuth client ID
- [ ] `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- [ ] `GOOGLE_REFRESH_TOKEN` — Google refresh token (Drive monitor, token refresh)
- [ ] `GOOGLE_PLACES_API_KEY` — Google Places API key (lead scraping, brand audit, GMB, SEO)
- [ ] `YOUTUBE_API_KEY` — YouTube Data API key (health check)
- [ ] `GOOGLE_ADS_DEVELOPER_TOKEN` — Google Ads developer token
- [ ] `GOOGLE_ADS_REFRESH_TOKEN` — Google Ads refresh token

## Slack

- [ ] `SLACK_BOT_TOKEN` — Slack bot token (notifications, workflow actions, production alerts)
- [ ] `SLACK_EDITORS_CHANNEL` — Slack channel for editor notifications (defaults to `#editors`)

## Discord

- [ ] `DISCORD_BOT_TOKEN` — Discord bot token (server creation, Midjourney integration)

## Twilio

- [ ] `TWILIO_ACCOUNT_SID` — Twilio account SID
- [ ] `TWILIO_AUTH_TOKEN` — Twilio auth token
- [ ] `TWILIO_PHONE_NUMBER` — Twilio phone number

## ElevenLabs

- [ ] `ELEVENLABS_API_KEY` — ElevenLabs API key (TTS, ElevenAgents)
- [ ] `ELEVENLABS_VOICE_ID` — ElevenLabs voice ID (defaults to `CwhRBWXzGAHq8TQ4Fs17`)

## WhatsApp

- [ ] `WHATSAPP_PHONE_NUMBER_ID` — WhatsApp Business phone number ID
- [ ] `WHATSAPP_ACCESS_TOKEN` — WhatsApp Cloud API access token
- [ ] `WHATSAPP_BUSINESS_ACCOUNT_ID` — WhatsApp Business account ID

## n8n (Workflow Automation)

- [ ] `N8N_BASE_URL` — n8n instance base URL
- [ ] `N8N_URL` — n8n instance URL (alternate, defaults to Railway URL)
- [ ] `N8N_API_KEY` — n8n API key
- [ ] `NEXT_PUBLIC_N8N_URL` — n8n URL exposed to frontend

## Stripe (alternate/extended)

(covered above under Billing)

## RunPod GPU (self-hosted AI)

- [x] `RUNPOD_API_KEY` — RunPod API key for serverless GPU endpoints
- [x] `RUNPOD_LLM_URL` — RunPod serverless LLM endpoint (replaces Claude for routine tasks)
- [x] `RUNPOD_FLUX_URL` — RunPod ComfyUI FLUX.1-dev endpoint (primary thumbnail generator)
- [x] `RUNPOD_SDXL_URL` — RunPod SDXL image generation endpoint (fallback)
- [x] `HIGGSFIELD_URL` — RunPod Mochi Video Generator endpoint (text-to-video)

## Video / Creative

- [ ] `REMOTION_RENDER_URL` — Remotion render service URL (defaults to Railway URL)
- [ ] `MIDJOURNEY_API_KEY` — Midjourney API key (via GoAPI/ImagineAPI)
- [ ] `MIDJOURNEY_CHANNEL_ID` — Discord channel ID for Midjourney

## Third-Party Integrations

- [ ] `RETELL_API_KEY` — Retell AI key (voice agents, cold calling)
- [ ] `CANVA_API_KEY` — Canva API key (design generation)
- [ ] `NOTION_API_KEY` — Notion API key (integration)
- [ ] `PANDADOC_API_KEY` — PandaDoc API key (contracts/proposals)
- [ ] `CALENDLY_API_TOKEN` — Calendly API token (scheduling)
- [ ] `VERCEL_API_TOKEN` — Vercel API token (deploy generated websites)
- [ ] `VERCEL_TEAM_ID` — Vercel team ID (optional, team-scoped deployments)
- [ ] `GODADDY_CUSTOMER_ID` — GoDaddy customer ID for domain purchase attribution
- [ ] `INSTANTLY_API_KEY` — Instantly API key (email outreach)
- [ ] `METRICOOL_API_KEY` — Metricool API key (social analytics)
- [ ] `ZERNIO_API_KEY` — Zernio API key

## Domain / Hosting

- [ ] `GODADDY_API_KEY` — GoDaddy API key (domain management)
- [ ] `GODADDY_API_SECRET` — GoDaddy API secret
- [ ] `VERCEL_TOKEN` — Vercel API token (website deployments)

## Email Marketing

- [ ] `SMTP_HOST` — SMTP host (Resend: `smtp.resend.com`)
- [ ] `SMTP_USER` — SMTP username (Resend: `resend`)
- [ ] `SMTP_PASS` — Resend API key (also used as `RESEND_API_KEY` fallback for audiences/emails endpoints)
- [ ] `SMTP_FROM` — sender address on a verified Resend domain (e.g. `growth@mail.shortstack.work`)
- [ ] `SMTP_PORT` — SMTP port (defaults to 587)
- [ ] `RESEND_API_KEY` — (optional) separate key if you don't want to reuse `SMTP_PASS`
- [ ] `MAILCHIMP_API_KEY` — Mailchimp API key (optional alternative to Resend for email marketing)
- [ ] `MAILCHIMP_SERVER_PREFIX` — Mailchimp server prefix (defaults to `us21`)
- [ ] `SMTP_POOL_PASSWORD` — shared password for custom SMTP identities in the outreach sender pool

### Email provider routing

The app routes outbound transactional/marketing email through
`src/lib/email/` — a provider abstraction. The active backend is
selected at runtime by `EMAIL_PROVIDER`. Resend stays as the default; Postal is
opt-in once the user provisions a self-hosted instance (see
`docs/SELF_HOSTED_SMTP_POSTAL.md`).

- [ ] `EMAIL_PROVIDER` — one of `resend` (default), `postal`, `smtp_generic`. Omit to use Resend.
- [ ] `POSTAL_API_URL` — only required if `EMAIL_PROVIDER=postal`. e.g. `https://mail.shortstack.work`.
- [ ] `POSTAL_API_KEY` — only required if `EMAIL_PROVIDER=postal`. Generated in Postal admin UI.
- [ ] (`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` already documented above — `smtp_generic` reuses them.)

## Webhooks / Automation

- [ ] `ZAPIER_WEBHOOK_URL` — Zapier webhook URL
- [ ] `MAKE_API_KEY` — Make.com webhook/API key
- [ ] `WEBHOOK_SECRET` — Generic inbound webhook bearer-token secret. Required in production for `/api/webhooks/inbound`, `/api/webhooks/resend/inbound`, and as a fallback for `/api/webhooks/ghl`. Routes return 503 in production if missing, 401 if Authorization header doesn't match. Dev deploys log a warning and accept unsigned. Rotate with `openssl rand -hex 32`.

## Misc / Client-Side

- [ ] `YELP_API_KEY` — Yelp Fusion API key (lead scraping)

> **Note:** `CRON_SECRET` is **server-only**. There must be no `NEXT_PUBLIC_CRON_SECRET` — exposing it in the client bundle would let any site visitor trigger cron/webhook routes. Voice-assistant quick actions go through the authed `/api/voice-actions` proxy, which checks the caller's Supabase session + role then forwards server-side with `CRON_SECRET`.
