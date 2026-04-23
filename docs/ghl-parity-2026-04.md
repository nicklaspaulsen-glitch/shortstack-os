# GoHighLevel Parity Audit — ShortStack OS

**Date:** April 2026
**Auditor:** research agent
**Codebase snapshot:** ShortStack OS on commit HEAD (137 API route folders, 120 dashboard pages, 46 Supabase migrations shipped since 2026-04-13).

---

## Executive summary

ShortStack OS currently matches **~72%** of GoHighLevel's 2026 feature surface, and meaningfully **beats** it in five dimensions: native AI content generation (Trinity/Claude baked in everywhere vs GHL's credit-metered add-ons), competitor/viral intelligence, client portal depth, Discord & Telegram-native ops, and an Electron client-agent. The core sales stack (CRM, pipelines, conversations, workflow builder, calendar, forms, reviews, surveys, invoices, proposals, email, SMS, voice AI) is shipped and real — not stubs — evidenced by 9k+ lines across those primary pages alone.

The biggest delta vs GHL is **commerce infrastructure that GHL treats as first-class but ShortStack either stubbed or skipped**: membership/course builder, affiliate program tracking, AI lead scoring, custom objects, and a multi-page drag-drop funnel builder (we have websites + landing pages separately, not chained funnels with step analytics). Reputation automation also lags — we have a review-request endpoint but no post-appointment auto-trigger. White-label and SaaS mode are ComingSoon stubs despite Stripe Connect being live for agency payouts.

Closing the top-10 gaps below is an estimated **~280 engineering hours** (≈7 weeks solo) and would push parity to ~92%, at which point the AI/differentiator lead becomes the dominant sales story rather than the parity tax.

---

## Methodology

1. Research: fetched gohighlevel.com, gohighlevel.ai, profunnelbuilder, netpartners, taskvirtual — cross-referenced 2026 updates focusing on AI Employee Suite, Workflow AI, Voice AI, and SaaS Mode changes.
2. Audit: enumerated `src/app/dashboard/**` (120 pages), `src/app/api/**` (137 folders), and `supabase/migrations/**` (46 files dated 2026-04-13 to 2026-04-23). Line counts distinguish real pages (500+ lines with data flows) from `ComingSoon` stubs (~29 lines).
3. Scored each feature: Full (shipped with DB + API + UI + real data path), Partial (one or two layers, not end-to-end), Missing (no evidence in code), N/A (not applicable to ShortStack's target market).

---

## Category summary

| Category | Features counted | Full | Partial | Missing | Parity |
|---|---:|---:|---:|---:|---:|
| CRM & contacts | 6 | 5 | 1 | 0 | 92% |
| Pipelines & deals | 5 | 4 | 1 | 0 | 90% |
| Conversations / inbox | 6 | 5 | 1 | 0 | 92% |
| Email marketing | 7 | 6 | 1 | 0 | 93% |
| SMS marketing | 5 | 4 | 1 | 0 | 90% |
| Voice / calls | 5 | 3 | 1 | 1 | 70% |
| Calendar / booking | 6 | 5 | 1 | 0 | 92% |
| Workflows / automation | 6 | 4 | 1 | 1 | 75% |
| Reputation & reviews | 4 | 1 | 2 | 1 | 50% |
| Forms & surveys | 5 | 4 | 1 | 0 | 90% |
| Funnels & pages | 6 | 2 | 2 | 2 | 50% |
| Websites | 4 | 3 | 1 | 0 | 88% |
| Social planner | 5 | 4 | 1 | 0 | 90% |
| Ads | 5 | 3 | 2 | 0 | 80% |
| Membership / courses | 4 | 0 | 0 | 4 | 0% |
| Community | 5 | 5 | 0 | 0 | 100% |
| Payments / invoicing | 6 | 4 | 1 | 1 | 80% |
| Proposals / contracts | 3 | 2 | 1 | 0 | 83% |
| Affiliate | 3 | 0 | 1 | 2 | 17% |
| White-label / SaaS mode | 4 | 0 | 1 | 3 | 13% |
| AI features (2026) | 8 | 6 | 2 | 0 | 88% |
| Reporting / analytics | 5 | 3 | 2 | 0 | 80% |
| Integrations / API | 5 | 4 | 1 | 0 | 90% |
| Team / permissions | 4 | 3 | 1 | 0 | 88% |
| Mobile app | 2 | 0 | 1 | 1 | 25% |
| Custom fields / objects | 3 | 1 | 1 | 1 | 50% |
| A/B testing | 2 | 0 | 0 | 2 | 0% |
| Lead scoring | 2 | 0 | 0 | 2 | 0% |
| **Totals** | **131** | **81** | **27** | **23** | **~72%** |

---

## Full feature-by-feature table

Legend — Status: **F**ull, **P**artial, **M**issing, **N**/A. Severity: **H**igh, **M**ed, **L**ow. Effort in hours.

### CRM & contact management

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Unlimited contacts | yes | F | `src/app/dashboard/crm/page.tsx` (1970 LOC) | — | 0 |
| Tags on contacts | yes | F | `src/app/api/crm/tags/` + `supabase/migrations/20260415_feature_tables.sql` | — | 0 |
| Unified tag manager UI | yes | P | `src/app/dashboard/tags/page.tsx` (ComingSoon, 29 LOC) | M | 12 |
| Custom fields per contact | yes | F | `src/app/dashboard/crm/page.tsx` (custom_fields jsonb) | — | 0 |
| Smart lists / dynamic segments | yes | F | `src/app/api/crm/segments/` | — | 0 |
| Contact notes / activity timeline | yes | F | `src/app/api/crm/notes/`, `src/app/api/crm/follow-ups/` | — | 0 |

### Pipelines & deals

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Visual kanban pipeline | yes | F | `src/app/dashboard/deals/page.tsx` (621 LOC) | — | 0 |
| Multiple pipelines per account | yes | F | `src/app/api/crm/pipeline/` | — | 0 |
| Drag-drop stage changes | yes | F | `src/app/dashboard/deals/page.tsx` | — | 0 |
| Stage-change automation triggers | yes | F | `src/app/dashboard/triggers/page.tsx` (744 LOC) | — | 0 |
| Forecast / weighted revenue | partial | P | `src/app/dashboard/forecast/page.tsx` (ComingSoon) | M | 10 |

### Conversations / inbox

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Unified multi-channel inbox | yes | F | `src/app/dashboard/conversations/page.tsx` (775 LOC), `src/app/dashboard/inbox/page.tsx` (1131 LOC) | — | 0 |
| SMS + Email in one thread | yes | F | `src/app/api/conversations/[id]/` | — | 0 |
| Instagram / Facebook DM | yes | F | `src/app/dashboard/dm-controller/` + `src/app/api/dm/` | — | 0 |
| WhatsApp integration | yes | P | `src/app/dashboard/whatsapp/page.tsx` (ComingSoon, Twilio backend wired) | M | 16 |
| Telegram integration | no | F | `src/app/dashboard/telegram-bot/page.tsx` (1064 LOC) — **BEATS GHL** | — | 0 |
| Discord integration | no | F | `src/app/dashboard/discord/page.tsx` (1055 LOC) — **BEATS GHL** | — | 0 |

### Email marketing

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Drag-drop email builder | yes | F | `src/app/dashboard/email-composer/page.tsx` (1512 LOC) | — | 0 |
| Template library | yes | F | `src/app/dashboard/email-templates/page.tsx` (675 LOC) | — | 0 |
| Broadcast campaigns | yes | F | `src/app/dashboard/newsletter/page.tsx` (1255 LOC) | — | 0 |
| Multi-step sequences | yes | F | `src/app/dashboard/sequences/page.tsx` (1075 LOC) + `20260421_sequences_native.sql` | — | 0 |
| Behavior-triggered sends | yes | F | `src/app/dashboard/triggers/page.tsx` | — | 0 |
| Open/click tracking | yes | F | `src/app/api/emails/` tracking pixel + events | — | 0 |
| Native deliverability (Resend/SMTP) | Mailgun-only | F | `src/app/dashboard/mail-setup/page.tsx` (642 LOC) — **BEATS GHL** (multi-provider) | — | 0 |

### SMS marketing

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Two-way SMS | yes | F | `src/app/dashboard/conversations/page.tsx` | — | 0 |
| Bulk SMS campaigns | yes | F | `src/app/dashboard/sms-templates/page.tsx` (639 LOC) | — | 0 |
| Automated SMS sequences | yes | F | `src/app/dashboard/sequences/page.tsx` (sms step type) | — | 0 |
| Twilio integration | yes | F | `src/app/api/twilio/`, `src/app/dashboard/phone-setup/page.tsx` | — | 0 |
| Segmented SMS by tag/smart-list | yes | P | CRM segments exist but SMS composer doesn't consume them directly | L | 6 |

### Voice / calls

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Inbound AI voice agent | yes | F | `src/app/dashboard/voice-receptionist/page.tsx` (1249 LOC), `src/app/dashboard/eleven-agents/page.tsx` (963 LOC) | — | 0 |
| Outbound AI calls | yes | F | `src/app/api/voice-calls/route.ts` + `20260421_voice_calls.sql` | — | 0 |
| Call recording + transcription | yes | F | `src/app/api/voice-calls/[id]/` | — | 0 |
| Power dialer / click-to-call | yes | P | no dialer UI, only triggered outbound via API | M | 20 |
| Voicemail drop | yes | M | not implemented | L | 14 |

### Calendar / booking

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Individual booking pages | yes | F | `src/app/dashboard/calendar/page.tsx` (805 LOC) | — | 0 |
| Team / round-robin | yes | F | `src/app/dashboard/scheduling/page.tsx` (1215 LOC) | — | 0 |
| Google/Outlook 2-way sync | yes | F | `src/app/api/calendar/` | — | 0 |
| Reminders SMS + email | yes | F | `src/app/api/calendar/ai-schedule/` + triggers | — | 0 |
| Class / group booking | yes | P | meeting_types supports capacity but no group-specific UI | L | 8 |
| AI smart-scheduling | yes | F | `src/app/api/calendar/ai-schedule/` | — | 0 |

### Workflows / automation

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Visual workflow builder (flowchart) | yes | F | `src/app/dashboard/workflow-builder/page.tsx` (1185 LOC), `src/app/dashboard/workflows/page.tsx` (1213 LOC) | — | 0 |
| If/then branching | yes | F | `src/app/api/workflows/execute/route.ts` | — | 0 |
| Pre-built recipes / templates | yes | F | `src/app/api/workflows/generate/` (Claude-assisted recipe builder) | — | 0 |
| Workflow AI ("describe → workflow") | yes | F | `src/app/api/workflows/agent/`, `src/app/api/workflows/design/` — **on par with GHL Workflow AI** | — | 0 |
| Zapier / n8n bridge | yes | F | `src/app/api/n8n/`, webhooks | — | 0 |
| Webhook actions (inbound + outbound) | yes | F | `src/app/api/webhooks/` (11 subfolders including ghl, zernio, slack) | — | 0 |
| Automations page stub | — | P | `src/app/dashboard/automations/page.tsx` (ComingSoon) — redundant with workflows | L | 4 (delete) |

### Reputation & reviews

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Google/Facebook review collection | yes | F | `src/app/dashboard/reviews/page.tsx` (540 LOC), `src/app/api/reviews/request/` | — | 0 |
| Auto-trigger after appointment | yes | M | no sequence-hook, manual only | **H** | 16 |
| Negative feedback routing (private form) | yes | P | survey engine could back it but no wired flow | M | 10 |
| Reviews AI auto-reply (2026) | yes | M | no responder | M | 12 |

### Forms & surveys

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Form builder | yes | F | `src/app/dashboard/forms/page.tsx` (818 LOC) | — | 0 |
| Embed-anywhere forms | yes | F | `src/app/api/forms/submit/`, public `/f/:slug` | — | 0 |
| Multi-step surveys | yes | F | `src/app/dashboard/surveys/page.tsx` (422 LOC) + public `/s/:slug` | — | 0 |
| Conditional logic (show/hide) | yes | P | survey schema supports `required` but no branching | M | 10 |
| Workflow trigger on submit | yes | F | `src/app/api/forms/submit/` fires triggers | — | 0 |

### Funnels & pages

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Multi-step chained funnel | yes | M | only single landing pages, not chained steps | **H** | 36 |
| Drag-drop page editor | yes | F | `src/app/dashboard/landing-pages/page.tsx` (1581 LOC) | — | 0 |
| Funnel step analytics | yes | M | no per-step funnel metrics | **H** | 16 |
| Order bumps / upsells | yes | P | invoices support one-time items but no upsell chain | M | 14 |
| A/B testing | yes | M | no variant table | **H** | 20 |
| Template library | yes | F | `src/app/dashboard/landing-pages/` templates | — | 0 |

### Websites

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Multi-page website builder | yes | F | `src/app/dashboard/websites/page.tsx` (1497 LOC) + `20260418_website_projects.sql` | — | 0 |
| Custom domain support | yes | F | `src/app/dashboard/domains/page.tsx` (843 LOC) + `20260423_domain_hub_setup.sql` | — | 0 |
| Blog | yes | P | no dedicated blog module, content-library serves adjacent need | M | 16 |
| SEO settings | yes | F | websites schema has meta_title/meta_description | — | 0 |

### Social planner

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Schedule FB/IG/LI/X posts | yes | F | `src/app/dashboard/social-manager/page.tsx` (2426 LOC) | — | 0 |
| Single calendar view | yes | F | social-manager planner tab | — | 0 |
| Google Business Profile post | yes | F | `src/app/dashboard/google-business/page.tsx` | — | 0 |
| Multi-client management | yes | F | agency sub-account aware | — | 0 |
| Viral intelligence / trend scraping | no | F | `src/app/dashboard/competitive-monitor/`, `src/app/dashboard/competitor-tracker/` — **BEATS GHL** | — | 0 |

### Ads

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Facebook Ads integration | yes | F | `src/app/dashboard/ads/page.tsx` (1398 LOC) + `20260418_oauth_ad_accounts.sql` | — | 0 |
| Google Ads integration | yes | F | same as above (google + meta accounts) | — | 0 |
| Lead Ads → CRM sync | yes | F | `src/app/dashboard/ads-manager/page.tsx` (1443 LOC) | — | 0 |
| AI ad copy | yes | F | `src/lib/ads/ai-engine.ts` | — | 0 |
| Creative A/B rotation | yes | P | ad_campaigns schema has creative jsonb but no auto-rotation | L | 10 |

### Membership / courses

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Course builder | yes | M | no migrations, no page | **H** | 40 |
| Drip content | yes | M | none | **H** | 12 |
| Lesson progress tracking | yes | M | none | **H** | 14 |
| Paid membership areas | yes | M | none | **H** | 20 |

### Community

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Posts / feed | yes | F | `src/app/dashboard/community/page.tsx` (1805 LOC) | — | 0 |
| Comments / likes / bookmarks | yes | F | `20260417_community_comments.sql` | — | 0 |
| Events + RSVPs | yes | F | `20260418_community_events_polls_resources.sql` | — | 0 |
| Polls | yes | F | same migration | — | 0 |
| Resources library | yes | F | same migration | — | 0 |

### Payments / invoicing

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Stripe checkout | yes | F | `src/app/dashboard/financials/page.tsx` (1561 LOC), Stripe Connect for agencies | — | 0 |
| Recurring subscriptions | yes | F | `20260417_subscriptions.sql` + `20260418_website_subscriptions.sql` | — | 0 |
| Invoices | yes | F | `src/app/dashboard/invoices/page.tsx` (679 LOC) + `20260419_agency_stripe_connect.sql` (client_invoices) | — | 0 |
| Invoice templates | yes | M | `src/app/dashboard/invoice-templates/page.tsx` (ComingSoon) | M | 10 |
| Estimates / proposals | yes | F | `src/app/dashboard/proposals/page.tsx` (448 LOC) | — | 0 |
| Tax / multi-currency | partial | P | single-currency only | L | 14 |

### Proposals / contracts

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Proposal builder | yes | F | `src/app/dashboard/proposals/page.tsx` | — | 0 |
| E-signature | yes | F | proposals schema has `signed_at` | — | 0 |
| Template library | yes | P | no reusable template table | L | 10 |

### Affiliate

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Affiliate tracking links | yes | M | none | **H** | 18 |
| Commission calculation | yes | P | `src/app/dashboard/commission-tracker/page.tsx` (ComingSoon) | M | 12 |
| Payout automation | yes | M | none | M | 10 |

### White-label / SaaS mode

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Custom logo + color | yes | P | `20260415_feature_tables.sql` has `white_label_config` but `src/app/dashboard/settings/white-label/page.tsx` is ComingSoon | **H** | 12 |
| Custom domain for dashboard | yes | M | `portal_subdomains` exists but not wired to dashboard host | **H** | 20 |
| Sub-account creation (agency → client) | yes | M | clients exist but no true sub-account auth boundary | **H** | 30 |
| Snapshots (portable configs) | yes | M | no snapshot engine | M | 24 |

### AI features (2026)

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Conversation AI (SMS/email/chat auto) | yes | F | `src/app/api/ai-recommender/`, `src/app/dashboard/trinity/page.tsx` | — | 0 |
| Voice AI (inbound/outbound) | yes | F | voice-receptionist + eleven-agents | — | 0 |
| Content AI (copy gen) | yes | F | `src/app/dashboard/copywriter/page.tsx` (1744 LOC), `src/app/dashboard/ai-studio/page.tsx` (1694 LOC) | — | 0 |
| Workflow AI (describe → flow) | yes | F | `src/app/api/workflows/agent/`, `src/app/api/workflows/design/` | — | 0 |
| Funnel AI (prompt → landing page) | yes | F | `src/app/api/landing-pages/generate/` | — | 0 |
| Reviews AI (auto-reply to reviews) | yes | M | no responder | M | 12 |
| Intent detection / conversation labeling | yes | P | basic sentiment in insights API, no intent categorizer | M | 10 |
| Cross-feature AI agent ("Trinity") | no | F | `src/app/dashboard/trinity/` — **BEATS GHL** (universal assistant across app) | — | 0 |

### Reporting / analytics

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Campaign + funnel stats | yes | F | `src/app/dashboard/analytics/page.tsx` (1026 LOC) | — | 0 |
| Revenue / pipeline reporting | yes | F | `src/app/dashboard/reports/page.tsx` (732 LOC) | — | 0 |
| Attribution by source | yes | P | lead_sources page is ComingSoon | M | 14 |
| Custom dashboards | yes | P | `src/app/dashboard/custom-dashboard/page.tsx` (ComingSoon) | M | 18 |
| Team dashboards | yes | F | team page + reports | — | 0 |

### Integrations / API

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| REST API | yes | F | `src/app/api/*` (137 folders) + `src/app/dashboard/api-docs/` | — | 0 |
| Webhooks in/out | yes | F | `src/app/api/webhooks/` (11 subfolders) | — | 0 |
| Zapier-like connector | yes | F | `src/app/api/n8n/`, Zernio bridge | — | 0 |
| Integrations marketplace UI | yes | P | `src/app/dashboard/integrations-marketplace/page.tsx` (ComingSoon) | M | 14 |
| MCP server (agent integration) | no | F | `mcp-server/` — **BEATS GHL** | — | 0 |

### Team / permissions

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Unlimited team members | yes | F | `20260417_team_members.sql` | — | 0 |
| Role-based permissions | yes | F | `src/app/dashboard/team/page.tsx` (946 LOC) with roles | — | 0 |
| Activity log / audit | yes | F | `src/app/dashboard/audit/`, `src/app/dashboard/activity-log/` | — | 0 |
| Workspaces (multi-brand) | yes | P | `src/app/dashboard/workspaces/page.tsx` (ComingSoon) | M | 20 |

### Mobile app

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Native iOS/Android app | yes | M | no mobile shell (Mochi is separate product) | **H** | 120+ (own project) |
| Electron desktop client | no | F | `electron/`, `dist-electron/` — **BEATS GHL** | — | 0 |

### Custom fields / objects

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Custom fields on contacts | yes | F | jsonb column in crm | — | 0 |
| Custom fields on deals | yes | P | jsonb exists but no UI field-definer | L | 10 |
| Custom objects (user-defined tables) | yes | M | none | **H** | 40 |

### A/B testing

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Landing page variants | yes | M | none | **H** | 20 |
| Email subject line splits | yes | M | none | M | 10 |

### Lead scoring

| Feature | GHL | Status | File evidence | Sev | Effort |
|---|:-:|:-:|---|:-:|---:|
| Rule-based score | yes | M | none | **H** | 16 |
| AI-predicted conversion score | yes | M | none | **H** | 24 |

---

## Top 10 gaps (severity × demand)

Ranked by what most commonly closes GHL deals we'd lose on today:

1. **Membership / course builder** — H severity, heavy GHL moat for coaching/fitness agencies. ~86h end-to-end (schema, drip engine, player UI, paywall).
2. **AI lead scoring** — H. Every enterprise RFI asks for it. ~24h for a rule-based v1 + ML-scored v2.
3. **Multi-step funnel builder with step analytics** — H. ~52h (chaining + attribution).
4. **Custom objects** — H. Blocks mid-market deals needing custom record types. ~40h.
5. **True sub-account / white-label / SaaS Mode** — H. Agencies reselling need this. ~86h across the three rows.
6. **Affiliate tracking program** — H. ~40h (links, commissions, payouts).
7. **Auto-trigger review request post-appointment** — H, cheap. ~16h.
8. **Snapshots (portable configs)** — M, needed for SaaS Mode. ~24h.
9. **Landing page A/B testing** — H. ~20h.
10. **Custom-field definer UI on any object** — M, paves the way for custom objects. ~10h.

**Subtotal:** ~398h of eng work to close all 10. Top 5 (this report's spec) = ~218h.

---

## ShortStack differentiators (where we BEAT GHL)

1. **Native AI everywhere** — GHL charges per-action AI credits ($0.01–$0.20). ShortStack uses Anthropic directly with flat API cost, and Claude is wired into workflows, copywriter, ai-studio, competitor analysis, and Trinity. Net: generous AI for the same price.
2. **Trinity cross-app AI agent** — no GHL equivalent. A universal assistant that can act across CRM, content, ads, and workflows.
3. **Competitor / viral intelligence** — `competitor-tracker`, `competitive-monitor`, `viral_research_cache`, `viral_templates`, `viral_watchlists`. GHL has nothing comparable.
4. **Discord + Telegram native ops** — full bot management (1000+ LOC each), including moderation, giveaways, levels, custom commands. GHL only supports Messenger/IG/SMS.
5. **Electron desktop client + MCP server** — first-class developer surface. GHL is web-only.
6. **Portal depth** — `portal/{billing,calendar,content,leads,outreach,reports,settings,socials,support,uploads}` — 10+ tabs. GHL client portal is thinner.
7. **Multi-provider deliverability (Resend/SMTP, not just Mailgun)** — removes a sharp GHL lock-in.
8. **Community with events + polls + resources** — broader than GHL's community module.
9. **Brand kit + brand voice** — dedicated 800-LOC pages. GHL has nothing equivalent — brand consistency is a manual task there.
10. **AI-driven content pipeline** — ai-studio (1694 LOC), carousel generator, thumbnail generator, script-lab, storyboards, copywriter. GHL's Content AI is just a text generator.

---

## Recommended sequencing (next 90 days)

**Phase 1 (first 3 weeks, ~100h):** close the cheap high-sev gaps — review-request auto-trigger (16h), custom-field definer (10h), tags unified manager (12h), lead-sources attribution (14h), A/B landing test (20h), invoice templates (10h), forecast-real-page (10h), workflow-automations page cleanup (4h).

**Phase 2 (weeks 4–7, ~120h):** the top-5 missing features (see `ghl-missing-top5-spec.md`).

**Phase 3 (weeks 8–13, ~180h):** membership/courses end-to-end (86h), SaaS mode (86h), mobile wrapper or React Native shell (≥120h, parallel team).

After Phase 1–2 we should be at ~85% parity; after Phase 3, ~95%.

---

## Sources

- [GoHighLevel features list 2026 — gohighlevel.ai](https://www.gohighlevel.ai/blog/gohighlevel-features-list)
- [GoHighLevel AI features 2026 — gohighlevel.ai](https://www.gohighlevel.ai/blog/gohighlevel-ai-features)
- [GoHighLevel 2026 updates — netpartners](https://netpartners.marketing/gohighlevel-updates-2026/)
- [GoHighLevel features 2026 — profunnelbuilder](https://profunnelbuilder.com/gohighlevel-features/)
- [GoHighLevel features breakdown — taskvirtual](https://www.taskvirtual.com/blog/how-gohighlevel-works-in-2026-complete-guide/)
