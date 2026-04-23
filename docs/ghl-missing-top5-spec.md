# Top 5 missing-feature specs — Closing the GHL gap

**Companion to:** `docs/ghl-parity-2026-04.md`
**Written for:** a future coding agent who will implement these cold. Each spec is self-contained — file paths are absolute within `shortstack-os/`.
**Total effort:** ~218 hours (~5.5 weeks solo).

Selection criteria: picked from the Top 10 gaps list, ranked by (severity × sales demand × build-leverage-per-hour). Filters out "big but slow" items like sub-accounts / SaaS mode (those get their own follow-up spec) and things that need a separate mobile project.

| # | Feature | Severity | Effort | Unlocks |
|---|---|:-:|---:|---|
| 1 | AI lead scoring | H | 24h | Enterprise RFIs, better routing |
| 2 | Auto review request after appointment | H | 16h | Reputation automation, reduces churn |
| 3 | Custom objects | H | 40h | Mid-market deals, unlimited verticals |
| 4 | Membership / course builder | H | 86h | Coaching/fitness vertical, MRR product |
| 5 | Multi-step funnel builder w/ analytics | H | 52h | Core GHL selling point, conversion uplift |

---

## 1. AI lead scoring

### User story
> As an agency owner, when a new lead fills a form or enters my CRM, I want a 0–100 score predicting conversion likelihood so my team focuses on the hottest ones first, and the score should update automatically as the lead engages.

### DB schema
`supabase/migrations/20260424_lead_scoring.sql`:
```sql
create table if not exists lead_score_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  trigger_event text not null, -- 'form_submit' | 'email_open' | 'email_click' | 'page_visit' | 'tag_added' | 'custom_field_update' | 'deal_stage_change'
  condition jsonb not null default '{}'::jsonb, -- e.g. {"tag":"hot"} or {"field":"budget","gte":5000}
  points integer not null default 0, -- can be negative
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on lead_score_rules(owner_id, is_active);

create table if not exists lead_scores (
  lead_id uuid primary key references leads(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  score integer not null default 0 check (score between 0 and 100),
  ai_score integer, -- null until first ML run
  ai_reasoning text, -- Claude's explanation
  ai_updated_at timestamptz,
  rule_breakdown jsonb not null default '[]'::jsonb, -- [{rule_id, points, fired_at}]
  updated_at timestamptz not null default now()
);
create index on lead_scores(owner_id, score desc);

create table if not exists lead_score_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  rule_id uuid references lead_score_rules(id) on delete set null,
  event_type text not null,
  points_applied integer not null,
  created_at timestamptz not null default now()
);
create index on lead_score_events(lead_id, created_at desc);

-- RLS: owner isolation on all three tables.
alter table lead_score_rules enable row level security;
alter table lead_scores enable row level security;
alter table lead_score_events enable row level security;
create policy "owner_rw" on lead_score_rules for all using (owner_id = auth.uid());
create policy "owner_rw" on lead_scores for all using (owner_id = auth.uid());
create policy "owner_rw" on lead_score_events for all using (
  exists (select 1 from leads l where l.id = lead_id and l.owner_id = auth.uid())
);
```

### API routes
- `GET/POST /api/lead-scoring/rules` — list and create.
- `PATCH/DELETE /api/lead-scoring/rules/[id]`.
- `POST /api/lead-scoring/recalculate` — batch re-score every lead under this owner. Triggered from UI "Recalculate all" button.
- `POST /api/lead-scoring/event` — internal, called by form-submit / workflow-execute / etc. with `{lead_id, event_type, payload}`. Fires matching rules, inserts `lead_score_events`, updates `lead_scores.score` (capped 0–100).
- `POST /api/lead-scoring/ai-score` — calls Claude Haiku with lead's enriched data (tags, custom fields, activity history, deal stage, engagement counts). Returns 0–100 `ai_score` + 1-sentence `ai_reasoning`. Cron-nightly at 02:00 UTC for stale leads (>24h since `ai_updated_at`).

Integration hooks to add:
- `/api/forms/submit/route.ts` — after insert, POST to `/api/lead-scoring/event` with `form_submit`.
- `/api/workflows/execute/route.ts` — after each step, emit event.
- `/api/emails/**` open/click trackers — emit event.

### Page + component tree
Route `/dashboard/lead-scoring`:
```
src/app/dashboard/lead-scoring/
  page.tsx                         ← tabs: Rules | Leaderboard | Settings
src/components/lead-scoring/
  rule-builder.tsx                 ← form to compose condition jsonb
  rule-list.tsx
  leaderboard.tsx                  ← top-100 leads sorted by score (rule + AI split bar)
  score-badge.tsx                  ← used throughout CRM / leads / conversations
```
Add a `<ScoreBadge leadId={id}/>` pill to existing `src/app/dashboard/crm/page.tsx`, `src/app/dashboard/leads/page.tsx`, and `src/app/dashboard/conversations/page.tsx` rows.

### Integration points
- Sidebar entry under "Sales" group.
- CRM filter "Score ≥ N".
- Workflow trigger: `lead_score_crossed` (new trigger type).

### Effort breakdown
Schema + migrations: 2h. Rule engine API + event emitter: 6h. AI scoring endpoint: 4h. Rule builder UI: 5h. Leaderboard + badge wiring: 4h. Workflow-trigger plumbing: 3h. **Total: 24h.**

### Ship-it pre-requisites
- Anthropic API key (already live).
- Cron runner slot (already using Vercel cron for reminders).
- Backfill script to populate `lead_scores` rows for existing leads (owner-scoped, idempotent).

---

## 2. Auto review request after appointment

### User story
> As a service business using ShortStack calendars, when a client's appointment ends, I want the system to automatically SMS/email them a review link 1 hour later, with smart routing of low-NPS responses to a private feedback form so my public Google reviews only show happy customers.

### DB schema
`supabase/migrations/20260424_review_automation.sql`:
```sql
create table if not exists review_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  trigger text not null, -- 'appointment_complete' | 'invoice_paid' | 'deal_won' | 'tag_added'
  trigger_config jsonb not null default '{}'::jsonb, -- {calendar_id?, tag?, stage?}
  delay_minutes integer not null default 60,
  channel text not null check (channel in ('email','sms','both')),
  email_template_id uuid references email_templates(id),
  sms_template_id uuid references sms_templates(id),
  nps_gate boolean not null default true, -- if true, ask 1-10 score first
  public_review_urls jsonb not null default '[]'::jsonb, -- [{platform:'google', url:'...'}]
  private_form_id uuid references forms(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists review_requests (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references review_campaigns(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  contact_name text,
  contact_email text,
  contact_phone text,
  trigger_event_id uuid, -- booking id / invoice id / etc
  scheduled_send_at timestamptz not null,
  sent_at timestamptz,
  nps_score integer check (nps_score between 0 and 10),
  nps_answered_at timestamptz,
  routed_to text, -- 'public' | 'private' | null
  public_review_posted_at timestamptz,
  created_at timestamptz not null default now()
);
create index on review_requests(owner_id, scheduled_send_at) where sent_at is null;

alter table review_campaigns enable row level security;
alter table review_requests enable row level security;
create policy "owner_rw" on review_campaigns for all using (owner_id = auth.uid());
create policy "owner_rw" on review_requests for all using (owner_id = auth.uid());
```

### API routes
- `GET/POST /api/reviews/campaigns`, `PATCH/DELETE /api/reviews/campaigns/[id]`.
- `POST /api/reviews/schedule` — internal, called by `/api/calendar/ai-schedule` on booking complete OR `/api/invoices/pay/` on paid. Inserts `review_requests` row with `scheduled_send_at = now + delay_minutes`.
- `GET /api/cron/send-review-requests` — cron every 5 min, selects due `review_requests`, calls Resend/Twilio, marks `sent_at`.
- `GET /r/:token` — public NPS page. If NPS ≥ 8 → redirect to public_review_urls[0]. If < 8 → redirect to private_form_id.
- `POST /api/reviews/nps` — public body `{token, score}`, writes `nps_score`, `routed_to`.

Already exists at `src/app/api/reviews/request/route.ts` — refactor into the scheduler.

### Page + component tree
Route `/dashboard/reviews/automation` (new tab on existing reviews page):
```
src/app/dashboard/reviews/
  page.tsx                         ← add tab "Auto-campaigns"
  automation/
    page.tsx                       ← list + edit campaigns
src/components/reviews/
  campaign-editor.tsx              ← trigger picker, delay slider, template picker, NPS toggle
  campaign-list.tsx
  nps-page.tsx                     ← renders on /r/:token
```

### Integration points
- `src/app/api/calendar/ai-schedule/route.ts` — on booking `status=completed`, POST to `/api/reviews/schedule`.
- `src/app/api/invoices/pay/route.ts` — on paid, POST same.
- `src/app/api/triggers/route.ts` — add `review_campaign_triggered` as a workflow step.
- Public route `src/app/r/[token]/page.tsx` — NPS UI (already used pattern for `/s/:slug` surveys).

### Effort breakdown
Schema + migration: 1h. Campaigns CRUD + UI: 4h. Scheduler + cron: 4h. NPS public page + routing: 3h. Calendar/invoice hook wiring: 3h. Refactor existing `request/` endpoint: 1h. **Total: 16h.**

### Ship-it pre-requisites
- Resend + Twilio already live.
- Existing templates tables + public routes (`/s`, `/f`) as precedent.
- Cron slot available.

---

## 3. Custom objects

### User story
> As a business with non-standard workflows (gym memberships, pet grooming appointments, real-estate listings), I want to define my own object types with my own fields, views, and automations — not be forced into contacts/deals/tickets — and I want them to behave like first-class CRM entities including tags, workflow triggers, and reporting.

### DB schema
`supabase/migrations/20260425_custom_objects.sql`:
```sql
create table if not exists custom_object_types (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null, -- url-safe, e.g. 'properties'
  name text not null, -- display, e.g. 'Properties'
  singular text not null, -- 'Property'
  icon text not null default 'Box',
  color text not null default '#6366f1',
  fields jsonb not null default '[]'::jsonb,
  -- fields item shape:
  -- { id, key, label, type: 'text'|'number'|'select'|'date'|'checkbox'|'relation'|'email'|'phone'|'url',
  --   required, options?: string[], relation_type_id?: uuid }
  primary_display_field text not null default 'name',
  created_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create table if not exists custom_object_records (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references custom_object_types(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb, -- {field_key: value}
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on custom_object_records(type_id, owner_id);
create index on custom_object_records using gin(data);
create index on custom_object_records using gin(tags);

create table if not exists custom_object_relations (
  id uuid primary key default gen_random_uuid(),
  from_record_id uuid not null references custom_object_records(id) on delete cascade,
  to_record_id uuid not null references custom_object_records(id) on delete cascade,
  relation_type text not null, -- user-defined label
  created_at timestamptz not null default now()
);
create index on custom_object_relations(from_record_id);
create index on custom_object_relations(to_record_id);

alter table custom_object_types enable row level security;
alter table custom_object_records enable row level security;
alter table custom_object_relations enable row level security;
create policy "owner_rw" on custom_object_types for all using (owner_id = auth.uid());
create policy "owner_rw" on custom_object_records for all using (owner_id = auth.uid());
create policy "owner_rw" on custom_object_relations for all using (
  exists (select 1 from custom_object_records r where r.id = from_record_id and r.owner_id = auth.uid())
);
```

### API routes
- `GET/POST /api/custom-objects/types` — list/create type.
- `GET/PATCH/DELETE /api/custom-objects/types/[id]` — manage type + fields.
- `GET/POST /api/custom-objects/types/[id]/records` — paginated list (supports `?q=`, `?tag=`, `?field[x]=y`), create record.
- `GET/PATCH/DELETE /api/custom-objects/records/[id]`.
- `POST /api/custom-objects/records/[id]/relate` — create relation.

Validation: on insert/update, validate `data` keys against `type.fields` (type-coerce + required checks).

### Page + component tree
```
src/app/dashboard/custom-objects/
  page.tsx                         ← list of types, "Create new type"
  [slug]/
    page.tsx                       ← table view of records for a type
    [recordId]/page.tsx            ← record detail + related records
    settings/page.tsx              ← field editor for this type
src/components/custom-objects/
  type-builder.tsx                 ← drag-drop field editor
  field-input.tsx                  ← renders the right input per field type
  record-table.tsx                 ← TanStack table with sort/filter
  relation-picker.tsx
```
Sidebar entry: for each `custom_object_types` row owned by user, render a menu item under "Data" section linking to `/dashboard/custom-objects/[slug]`.

### Integration points
- Workflows: add trigger `custom_object_record_created` + action `create_custom_object_record`.
- Tags system: reuse existing `tags` text[] column pattern.
- Reports: generic "records per type, over time" chart.
- Webhooks: emit `custom_object.created|updated|deleted` events.
- Custom-field definer gap (item #10 from parity report) is subsumed by this spec's field editor — reuse same component for contacts/deals.

### Effort breakdown
Schema + policies: 3h. Types CRUD + field editor UI: 10h. Records CRUD + validation: 8h. Generic record table view: 8h. Dynamic sidebar + routing: 4h. Workflow triggers: 4h. Relations + relation picker: 3h. **Total: 40h.**

### Ship-it pre-requisites
- Existing workflows engine (already live).
- Sidebar preference table (already live at `20260418_sidebar_preferences.sql`) — extend to hold custom entries.

---

## 4. Membership / course builder

### User story
> As a coach or course creator, I want to build gated courses with lessons, drip schedules, quizzes, and progress tracking, sell access via Stripe, and track student completion — all inside ShortStack so my customers don't need Kajabi/Teachable.

### DB schema
`supabase/migrations/20260426_courses.sql`:
```sql
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  cover_image_url text,
  price_cents integer, -- null = free
  stripe_price_id text,
  drip_mode text not null default 'none' check (drip_mode in ('none','daily','weekly','custom')),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create table if not exists course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index on course_modules(course_id, position);

create table if not exists course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references course_modules(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  content_type text not null check (content_type in ('video','text','quiz','file')),
  video_url text,
  body_markdown text,
  attachment_url text,
  drip_delay_days integer not null default 0,
  created_at timestamptz not null default now()
);
create index on course_lessons(module_id, position);

create table if not exists course_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references course_lessons(id) on delete cascade,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_index integer not null,
  position integer not null default 0
);

create table if not exists course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  user_email text not null,
  stripe_payment_intent text,
  enrolled_at timestamptz not null default now(),
  unique (course_id, user_email)
);
create index on course_enrollments(course_id);

create table if not exists course_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references course_enrollments(id) on delete cascade,
  lesson_id uuid not null references course_lessons(id) on delete cascade,
  completed_at timestamptz,
  quiz_score integer,
  unique (enrollment_id, lesson_id)
);

alter table courses enable row level security;
alter table course_modules enable row level security;
alter table course_lessons enable row level security;
alter table course_quiz_questions enable row level security;
alter table course_enrollments enable row level security;
alter table course_lesson_progress enable row level security;

create policy "owner_rw" on courses for all using (owner_id = auth.uid());
create policy "course_owner_modules" on course_modules for all using (
  exists (select 1 from courses c where c.id = course_id and c.owner_id = auth.uid())
);
create policy "course_owner_lessons" on course_lessons for all using (
  exists (select 1 from course_modules m join courses c on c.id = m.course_id where m.id = module_id and c.owner_id = auth.uid())
);
-- (similar owner-chain policies for quiz_questions, enrollments, progress; plus public read-own-enrollment policies keyed by user_email match)
```

### API routes
- `GET/POST /api/courses`, `GET/PATCH/DELETE /api/courses/[id]`.
- `POST /api/courses/[id]/modules`, `PATCH /api/courses/modules/[id]`, etc. (CRUD pyramid for modules/lessons/quiz-qs).
- `POST /api/courses/[id]/publish` — requires at least 1 module + 1 lesson; creates Stripe price if paid.
- `POST /api/courses/[id]/enroll` — for free courses. For paid, use Stripe checkout callback in `webhooks/stripe-connect`.
- `GET /api/courses/[id]/progress/[email]` — returns enrollment + completed lessons.
- `POST /api/courses/lessons/[id]/complete` — student marks done.
- `POST /api/courses/lessons/[id]/quiz-submit` — grades quiz.

Drip enforcement: `course_lessons.drip_delay_days` compared to `course_enrollments.enrolled_at` — if `now < enrolled_at + drip_delay_days`, API returns `{locked: true, unlocks_at}`.

### Page + component tree
Creator side:
```
src/app/dashboard/courses/
  page.tsx                         ← list of owner's courses
  [id]/
    page.tsx                       ← curriculum builder (modules + lessons tree)
    settings/page.tsx              ← pricing + drip + Stripe
    students/page.tsx              ← enrolled students + progress
src/components/courses/
  curriculum-tree.tsx              ← drag-drop modules/lessons
  lesson-editor.tsx                ← video/text/quiz tabs
  quiz-builder.tsx
  enrollment-table.tsx
```
Public student side (replaces coming-soon membership idea):
```
src/app/learn/[courseSlug]/
  page.tsx                         ← landing + enroll CTA
  lesson/[lessonId]/page.tsx       ← gated player / reader
  dashboard/page.tsx               ← student progress view
src/components/learn/
  lesson-player.tsx
  progress-bar.tsx
  drip-lock-card.tsx
```
Sidebar: add "Courses" entry under "Revenue" group.

### Integration points
- Stripe: reuse `stripe-connect` for checkout and payouts.
- Email: reuse `sendEmail` for welcome/drip notifications.
- Workflows: triggers `course_enrolled`, `lesson_completed`, `course_completed`.
- CRM: auto-create a `lead` with tag `course:{slug}` on enrollment, link to `course_enrollments.user_email`.
- Reviews automation: could auto-trigger on `course_completed`.

### Effort breakdown
Schema + RLS: 6h. Creator CRUD APIs: 12h. Curriculum UI + lesson editor: 20h. Quiz builder: 6h. Public lesson player: 14h. Stripe checkout + enroll flow: 8h. Drip engine + cron: 6h. Progress tracking + student dashboard: 8h. Email welcome/drip: 4h. E2E test pass: 2h. **Total: 86h.**

### Ship-it pre-requisites
- Stripe Connect (live).
- Video hosting decision: recommend using MUX or Cloudflare Stream, with a fallback to direct `<video src>` from Supabase Storage for v1 (keeps cost flat).
- Public routes `/learn/` — add to middleware allowlist (no auth required).

---

## 5. Multi-step funnel builder with step analytics

### User story
> As a performance marketer, I want to build multi-page funnels (opt-in → video → offer → upsell → thank-you) where each page hands off the lead to the next, and I want to see conversion % at every step so I can pinpoint where my funnel leaks.

### DB schema
`supabase/migrations/20260427_funnels.sql`:
```sql
create table if not exists funnels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  is_published boolean not null default false,
  domain text,
  created_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create table if not exists funnel_steps (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references funnels(id) on delete cascade,
  position integer not null,
  slug text not null, -- e.g. 'opt-in', 'video', 'offer'
  step_type text not null check (step_type in ('opt_in','sales','video','order','upsell','downsell','thank_you','custom')),
  landing_page_id uuid references website_projects(id), -- reuse existing page builder!
  next_step_id uuid references funnel_steps(id) on delete set null,
  -- branching (upsell accept vs decline)
  branch_accept_id uuid references funnel_steps(id) on delete set null,
  branch_decline_id uuid references funnel_steps(id) on delete set null,
  config jsonb not null default '{}'::jsonb, -- offer_price, video_url, etc.
  created_at timestamptz not null default now(),
  unique (funnel_id, position)
);
create index on funnel_steps(funnel_id, position);

create table if not exists funnel_sessions (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references funnels(id) on delete cascade,
  visitor_token text not null, -- client-set cookie
  lead_id uuid references leads(id),
  started_at timestamptz not null default now(),
  last_step_id uuid references funnel_steps(id),
  completed boolean not null default false,
  completed_at timestamptz,
  source text, -- utm
  medium text,
  campaign text,
  unique (funnel_id, visitor_token)
);
create index on funnel_sessions(funnel_id, started_at desc);

create table if not exists funnel_step_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references funnel_sessions(id) on delete cascade,
  step_id uuid not null references funnel_steps(id) on delete cascade,
  event_type text not null check (event_type in ('view','convert','abandon')),
  value_cents integer, -- for order steps
  created_at timestamptz not null default now()
);
create index on funnel_step_events(step_id, event_type);

-- A/B variants (addresses parity gap #9 too)
create table if not exists funnel_step_variants (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references funnel_steps(id) on delete cascade,
  label text not null, -- 'A' / 'B'
  landing_page_id uuid not null references website_projects(id),
  weight integer not null default 50,
  created_at timestamptz not null default now()
);

alter table funnels enable row level security;
alter table funnel_steps enable row level security;
alter table funnel_sessions enable row level security;
alter table funnel_step_events enable row level security;
alter table funnel_step_variants enable row level security;
create policy "owner_rw" on funnels for all using (owner_id = auth.uid());
-- chain policies via funnel_id lookup
```

### API routes
- `GET/POST /api/funnels`, `PATCH/DELETE /api/funnels/[id]`.
- `GET/POST/PATCH/DELETE /api/funnels/[id]/steps`.
- `POST /api/funnels/[id]/publish` — validates graph (no cycles, one entry, all terminals are thank-you).
- `POST /api/funnels/track` — public, takes `{funnel_slug, step_slug, event_type, visitor_token, utm}` — upserts session + event.
- `GET /api/funnels/[id]/analytics` — returns per-step views/converts/dropoff %, variant winner, revenue.
- `POST /api/funnels/[id]/duplicate` — clones template.

### Page + component tree
Builder:
```
src/app/dashboard/funnels/
  page.tsx                         ← list + templates
  [id]/
    page.tsx                       ← graph canvas (react-flow — already used in workflow-builder!)
    step/[stepId]/page.tsx         ← edit step (reuses landing-page editor via iframe/portal)
    analytics/page.tsx             ← funnel-wide metrics + sankey dropoff chart
src/components/funnels/
  funnel-graph.tsx                 ← react-flow canvas, nodes per step
  step-node.tsx                    ← custom node type
  step-editor-drawer.tsx
  analytics-sankey.tsx
```
Public site: visitor lands on `{domain}/{funnel.slug}/{step.slug}`; the page is served by existing `src/app/p/[slug]/page.tsx` (from landing-pages/website_projects), wrapped in a `<FunnelTracker>` that auto-fires `/api/funnels/track` on mount + CTA click.

### Integration points
- Reuse `website_projects` as the page body of each step — no new page builder needed.
- Reuse `react-flow` (already in `workflow-builder`) for the funnel graph canvas.
- CRM: on opt-in step convert, create lead + attach funnel_session → lead_id.
- Workflows: trigger `funnel_step_converted`.
- Lead scoring (spec #1): each funnel conversion emits a score event.
- Reports: funnel analytics feeds the main `/dashboard/analytics`.

### Effort breakdown
Schema + RLS + indexes: 4h. Funnels CRUD: 4h. Steps CRUD + graph validator: 4h. React-flow canvas + node types: 10h. Step editor drawer (embed existing landing page editor): 6h. Public-side FunnelTracker + session cookie: 6h. Analytics API + sankey viz: 8h. Variants / A-B: 6h. Template library seed: 2h. E2E: 2h. **Total: 52h.**

### Ship-it pre-requisites
- `website_projects` table (live) as the page primitive.
- `react-flow` pkg (already installed for workflow-builder).
- Public `/p/:slug` route (live for landing pages) — extend to support nested funnel path.

---

## Global ship checklist (applies to all 5)

- [ ] Add migration to `supabase/migrations/` and apply via Supabase MCP before UI work.
- [ ] Write unit tests for critical server logic (rule engine in #1, gating in #4, graph validator in #5).
- [ ] Add feature-flag keys in `settings` table so agencies can toggle the new surface for their clients before GA.
- [ ] Update `src/components/dashboard/sidebar.tsx` to include new top-level entries under appropriate section.
- [ ] Backfill: if the feature affects existing data (e.g. lead-scoring default = 0 per lead), write a one-shot migration step.
- [ ] Add an audit-log event type for each mutating API route (reuse `src/app/api/audit-log/`).
- [ ] Update `docs/` with a short user-facing guide per feature.
- [ ] Add to the top-nav command palette (Cmd+K) for discoverability.
- [ ] Run `npm run build` + `npm run typecheck` + `npm run test` green before PR.

---

## Appendix: items deliberately out of scope

These were top-10 candidates but dropped from this spec because they need parallel/owner-agency-level design:

- **Sub-account / white-label / SaaS Mode** — architectural work (multi-tenant boundary), needs its own spec with auth re-architecture.
- **Mobile native app** — belongs in a separate React Native repo, not in shortstack-os.
- **Snapshots** — depends on SaaS Mode being done first (nothing to snapshot without client scoping).

---

## Appendix: effort math

| # | Feature | Hours |
|---|---|---:|
| 1 | AI lead scoring | 24 |
| 2 | Auto review request | 16 |
| 3 | Custom objects | 40 |
| 4 | Membership / courses | 86 |
| 5 | Funnel builder + A/B | 52 |
| | **Total** | **218** |

At ~40 focused hours/week solo → **5.5 weeks**. With one agent doing DB/API and one doing UI in parallel → **~3 weeks**.
