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

## GoHighLevel (GHL)

- [ ] `GHL_API_KEY` — GHL API key (CRM, outreach, email, calls, follow-ups)
- [ ] `GHL_LOCATION_ID` — GHL location ID
- [ ] `GHL_COMPANY_ID` — GHL company ID (sub-account creation)
- [ ] `GHL_AGENCY_KEY` — GHL agency-level API key (sub-account provisioning)

## Telegram

- [ ] `TELEGRAM_BOT_TOKEN` — Telegram bot token (notifications, webhook commands, reminders)
- [ ] `TELEGRAM_CHAT_ID` — Default Telegram chat ID for notifications

## Stripe (Billing)

- [ ] `STRIPE_SECRET_KEY` — Stripe secret key (invoices, subscriptions, license validation)
- [ ] `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- [ ] `STRIPE_BILLING_WEBHOOK_SECRET` — Stripe billing-specific webhook secret (optional, falls back to `STRIPE_WEBHOOK_SECRET`)

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
- [ ] `RUNPOD_LLM_URL` — RunPod serverless LLM endpoint (replaces Claude for routine tasks)
- [ ] `HIGGSFIELD_URL` — RunPod serverless Higgsfield video generation endpoint

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
- [ ] `LOVABLE_API_KEY` — Lovable API key (website/app generation)
- [ ] `INSTANTLY_API_KEY` — Instantly API key (email outreach)
- [ ] `METRICOOL_API_KEY` — Metricool API key (social analytics)
- [ ] `ZERNIO_API_KEY` — Zernio API key

## Domain / Hosting

- [ ] `GODADDY_API_KEY` — GoDaddy API key (domain management)
- [ ] `GODADDY_API_SECRET` — GoDaddy API secret
- [ ] `VERCEL_TOKEN` — Vercel API token (website deployments)

## Email Marketing

- [ ] `MAILCHIMP_API_KEY` — Mailchimp API key
- [ ] `MAILCHIMP_SERVER_PREFIX` — Mailchimp server prefix (defaults to `us21`)
- [ ] `SENDGRID_API_KEY` — SendGrid API key
- [ ] `SENDGRID_FROM_EMAIL` — SendGrid sender email (defaults to `hello@shortstack.agency`)

## Webhooks / Automation

- [ ] `ZAPIER_WEBHOOK_URL` — Zapier webhook URL
- [ ] `MAKE_API_KEY` — Make.com webhook/API key
- [ ] `WEBHOOK_SECRET` — Generic inbound webhook secret (falls back to `CRON_SECRET`)

## Misc / Client-Side

- [ ] `NEXT_PUBLIC_CRON_SECRET` — Cron secret exposed to frontend (voice assistant quick actions)
- [ ] `YELP_API_KEY` — Yelp Fusion API key (lead scraping)
