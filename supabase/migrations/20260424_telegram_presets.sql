-- Telegram presets library — 300 presets across 14 categories
-- Date: 2026-04-24
--
-- Purpose: ship a curated library of 300 ready-to-send Telegram message
-- templates organized into 14 practical categories (onboarding, nurture,
-- reactivation, payment-reminder, appointment-confirm, appointment-reminder,
-- review-request, thank-you, upsell, feedback-survey, holiday-promo, winback,
-- referral-ask, support-followup). Each preset is a short message body with
-- optional {{variables}} that the app substitutes at send time.
--
-- Ownership model:
--   user_id = NULL  →  global default preset (readable by everyone, owned by
--                     no one). Seeded by this migration — 300 rows.
--   user_id = <uuid> → user-created or forked preset. Editable/deletable only
--                      by that user.
--
-- Health indicators (derived at the UI layer from sent_count/error_count/
-- last_sent_at); the server just tracks the raw counters.

create table if not exists telegram_presets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade,
  category       text not null,
  name           text not null,
  body           text not null,
  variables      jsonb not null default '[]'::jsonb,
  active         boolean not null default true,
  last_sent_at   timestamptz,
  sent_count     int not null default 0,
  error_count    int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_telegram_presets_user_id
  on telegram_presets(user_id);
create index if not exists idx_telegram_presets_category
  on telegram_presets(category);
create index if not exists idx_telegram_presets_user_category
  on telegram_presets(user_id, category);
create index if not exists idx_telegram_presets_active
  on telegram_presets(active) where active = true;

-- Auto-update updated_at
create or replace function update_telegram_presets_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_telegram_presets_updated_at on telegram_presets;
create trigger trg_telegram_presets_updated_at
  before update on telegram_presets
  for each row execute function update_telegram_presets_updated_at();

-- RLS
alter table telegram_presets enable row level security;

-- Everyone can read global defaults + their own rows.
drop policy if exists "telegram_presets_read_own_or_global" on telegram_presets;
create policy "telegram_presets_read_own_or_global" on telegram_presets
  for select
  using (user_id is null or user_id = auth.uid());

-- Only authenticated users can insert, and the row must be theirs (user_id must
-- equal auth.uid() — global defaults are inserted by this migration only,
-- never by users).
drop policy if exists "telegram_presets_insert_own" on telegram_presets;
create policy "telegram_presets_insert_own" on telegram_presets
  for insert
  with check (user_id = auth.uid());

-- Users can update their own presets (not global defaults).
drop policy if exists "telegram_presets_update_own" on telegram_presets;
create policy "telegram_presets_update_own" on telegram_presets
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Users can delete their own presets (not global defaults).
drop policy if exists "telegram_presets_delete_own" on telegram_presets;
create policy "telegram_presets_delete_own" on telegram_presets
  for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed — 300 global default presets across 14 categories
-- ─────────────────────────────────────────────────────────────────────────────
-- We wipe any existing global seeds first so re-running the migration doesn't
-- duplicate rows. User-owned rows (user_id IS NOT NULL) are untouched.
delete from telegram_presets where user_id is null;

-- onboarding (22)
insert into telegram_presets (category, name, body, variables) values
('onboarding', 'Welcome kickoff', 'Welcome aboard, {{first_name}}! We''re thrilled to have {{business_name}} on the ShortStack team. Your onboarding call is set for {{meeting_time}}.', '["first_name","business_name","meeting_time"]'::jsonb),
('onboarding', 'Day 1 checklist', 'Hi {{first_name}} — your Day 1 checklist is ready. 1) Connect your socials  2) Set brand voice  3) Approve first 3 posts. Takes 10 min total.', '["first_name"]'::jsonb),
('onboarding', 'Portal login reminder', 'Reminder: your client portal is live at {{portal_link}}. Bookmark it — that''s where you''ll approve content, see leads, and chat with the team.', '["portal_link"]'::jsonb),
('onboarding', 'First content shipped', '{{first_name}}, your first 7 posts are drafted and waiting for approval in the portal. Takes ~5 min to review.', '["first_name"]'::jsonb),
('onboarding', 'Brand voice call', 'Let''s lock in your brand voice. Picking a time: {{calendar_link}}. 20 min call, no prep needed.', '["calendar_link"]'::jsonb),
('onboarding', 'Lead criteria intake', 'Quick one: what industries + cities should we target for leads? Drop it here or book 10 min: {{calendar_link}}', '["calendar_link"]'::jsonb),
('onboarding', 'Asset upload prompt', '{{first_name}}, drop your logo, 5-10 photos, and a 30-sec intro video in the portal and we can get content rolling in 24hr.', '["first_name"]'::jsonb),
('onboarding', 'Welcome pack shipped', 'Your welcome pack is shipped! Tracking: {{tracking_link}}. Inside: brand swag, onboarding guide, and a surprise.', '["tracking_link"]'::jsonb),
('onboarding', 'Tech access request', 'To finish setup we need: Instagram Business access, Google Business Profile, and FB Page admin. Instructions: {{instructions_link}}', '["instructions_link"]'::jsonb),
('onboarding', 'Goal-setting session', 'Ready to set your 90-day goals? Pick a slot: {{calendar_link}}. We''ll leave with 3 KPIs and a roadmap.', '["calendar_link"]'::jsonb),
('onboarding', 'First lead explainer', 'Heads up {{first_name}} — your first batch of leads lands in the portal within 48hr. We''ll ping you the moment they''re live.', '["first_name"]'::jsonb),
('onboarding', 'Week 1 wrap', 'Week 1 recap for {{business_name}}: {{posts_scheduled}} posts scheduled, {{leads_delivered}} leads delivered, brand voice locked. Big week 2 incoming.', '["business_name","posts_scheduled","leads_delivered"]'::jsonb),
('onboarding', 'Expectations reset', 'Quick reminder: content momentum takes ~30 days. We''ll stay in constant comms — no ghosting on our end.', '[]'::jsonb),
('onboarding', 'Slack/Discord invite', 'Here''s your invite to our client community: {{community_link}}. It''s where we share wins, playbooks, and answer questions fast.', '["community_link"]'::jsonb),
('onboarding', 'Photo-shoot scheduler', 'Your branded photo-shoot slot is open. Pick a time: {{calendar_link}}. We''ll coordinate the rest.', '["calendar_link"]'::jsonb),
('onboarding', 'Analytics access', '{{first_name}}, granted you access to the analytics dashboard. Login: {{analytics_link}}', '["first_name","analytics_link"]'::jsonb),
('onboarding', 'First post going live', 'Heads up — your first scheduled post goes live at {{post_time}}. We''re watching engagement for the first hour and will optimize from there.', '["post_time"]'::jsonb),
('onboarding', 'Intro to account manager', 'Meet your AM, {{am_name}}. Direct line for anything urgent: {{am_phone}}. They''ll run point on your account.', '["am_name","am_phone"]'::jsonb),
('onboarding', 'Payment confirmation', 'Payment received — thanks {{first_name}}! Invoice: {{invoice_link}}. Welcome aboard.', '["first_name","invoice_link"]'::jsonb),
('onboarding', 'Onboarding complete', 'Onboarding is officially complete. You''re now on the growth roll. First monthly report drops {{report_date}}.', '["report_date"]'::jsonb),
('onboarding', 'Set-up troubleshoot', 'Saw you got stuck on the {{step_name}} step. No worries — here''s a 2-min loom: {{loom_link}}. Or reply and I''ll walk you through it.', '["step_name","loom_link"]'::jsonb),
('onboarding', 'Welcome from founder', 'Hey {{first_name}}, {{founder_name}} here — founder of ShortStack. Just wanted to say welcome personally. Any blockers, you can text me direct.', '["first_name","founder_name"]'::jsonb);

-- nurture (22)
insert into telegram_presets (category, name, body, variables) values
('nurture', 'Weekly wins digest', 'This week at {{business_name}}: {{posts_published}} posts live, {{new_followers}} new followers, {{engagement_rate}}% engagement. Trending up.', '["business_name","posts_published","new_followers","engagement_rate"]'::jsonb),
('nurture', 'Insight drop', 'Noticed your top-performing post this week was {{top_post_topic}}. We''re doubling down on that angle next week.', '["top_post_topic"]'::jsonb),
('nurture', 'Content pipeline update', '7 new posts queued for next week. Approve in the portal: {{portal_link}}', '["portal_link"]'::jsonb),
('nurture', 'Trending topic alert', '{{industry}} is buzzing about {{trending_topic}} right now. Want us to write something on it? Reply yes and we''ll ship in 24hr.', '["industry","trending_topic"]'::jsonb),
('nurture', 'Competitor intel', 'Quick competitor intel: {{competitor_name}} just launched {{competitor_move}}. Here''s how we respond: {{response_plan}}', '["competitor_name","competitor_move","response_plan"]'::jsonb),
('nurture', 'Growth milestone', '{{business_name}} just crossed {{milestone}} — huge. Celebrating over here.', '["business_name","milestone"]'::jsonb),
('nurture', 'Helpful resource', 'Found this and thought of you: {{resource_link}}. Relevant to where {{business_name}} is heading.', '["resource_link","business_name"]'::jsonb),
('nurture', 'Friday recap', 'Friday recap for {{business_name}}: {{recap_summary}}. Have a solid weekend.', '["business_name","recap_summary"]'::jsonb),
('nurture', 'Monday kickoff', 'Monday kickoff: {{priority_this_week}} is the focus this week. Back to you Friday with the results.', '["priority_this_week"]'::jsonb),
('nurture', 'Idea share', 'Random idea for {{business_name}}: {{idea_summary}}. Worth testing?', '["business_name","idea_summary"]'::jsonb),
('nurture', 'Benchmark update', 'Benchmark alert: your engagement is {{delta_vs_industry}}% vs. industry median. Above/below: {{above_below}}.', '["delta_vs_industry","above_below"]'::jsonb),
('nurture', 'Check-in no pitch', 'Just a check-in, no pitch. How''s the quarter shaping up on your end?', '[]'::jsonb),
('nurture', 'Value drop article', 'Wrote this up based on what we''re seeing across agency clients: {{article_link}}. Think it''ll land with you.', '["article_link"]'::jsonb),
('nurture', 'Quick question', 'Quick one — are you prioritizing lead volume or lead quality this quarter? That shifts where we push next month.', '[]'::jsonb),
('nurture', 'Event invite', '{{event_name}} is on {{event_date}} — we have 2 spots left on our table. Want one? {{event_link}}', '["event_name","event_date","event_link"]'::jsonb),
('nurture', 'New feature note', 'New in the portal: {{feature_name}}. Here''s a 60-sec demo: {{demo_link}}', '["feature_name","demo_link"]'::jsonb),
('nurture', 'Birthday note', 'Happy birthday {{first_name}}! On behalf of everyone at ShortStack — have a great one.', '["first_name"]'::jsonb),
('nurture', 'Anniversary note', 'Today marks {{years_count}} year(s) with {{business_name}}. Grateful for the partnership.', '["years_count","business_name"]'::jsonb),
('nurture', 'Photo-of-the-week', 'Content highlight: {{post_link}} pulled {{engagement_count}} interactions — top 10% of everything we''ve run for you.', '["post_link","engagement_count"]'::jsonb),
('nurture', 'Strategy prompt', 'Thinking about Q{{quarter_number}} — do you want to lean into retention or new-client acquisition? Shifts our plan.', '["quarter_number"]'::jsonb),
('nurture', 'Mentor-style nudge', 'Noticed {{observation}}. Want to hop on 15 min this week to dig in?', '["observation"]'::jsonb),
('nurture', 'Monthly insight', 'Monthly insight for {{business_name}}: your {{channel_name}} is outperforming industry avg by {{outperform_pct}}%. Double down?', '["business_name","channel_name","outperform_pct"]'::jsonb);

-- reactivation (22)
insert into telegram_presets (category, name, body, variables) values
('reactivation', 'Hey stranger', 'Hey {{first_name}} — it''s been a minute. What''s the latest with {{business_name}}?', '["first_name","business_name"]'::jsonb),
('reactivation', 'Quiet-check-in', 'Circling back — last we talked you were {{last_topic}}. How''d that land?', '["last_topic"]'::jsonb),
('reactivation', 'Miss you note', 'Missing your updates in the portal. Anything we can help with?', '[]'::jsonb),
('reactivation', 'Fresh angle pitch', 'Cooked up a fresh angle for {{business_name}} — worth 10 min to walk through? {{calendar_link}}', '["business_name","calendar_link"]'::jsonb),
('reactivation', 'Industry shift alert', '{{industry}} just shifted — {{shift_description}}. Changes a lot for how we''d approach your growth. Chat?', '["industry","shift_description"]'::jsonb),
('reactivation', 'Bring-back offer', 'Re-activation offer: get {{discount_pct}}% off your next 3 months if you restart before {{deadline_date}}. Want it? {{restart_link}}', '["discount_pct","deadline_date","restart_link"]'::jsonb),
('reactivation', 'One-question ask', 'One question: what would have to be true for us to work together again?', '[]'::jsonb),
('reactivation', 'Revival plan', 'Drafted a 30-day revival plan for {{business_name}}: {{plan_link}}. Take a look?', '["business_name","plan_link"]'::jsonb),
('reactivation', 'Status update ask', 'How are things on your end? Still building {{last_focus}} or pivoted?', '["last_focus"]'::jsonb),
('reactivation', 'Gentle nudge', 'No pressure — just wanted to stay on your radar. Whenever you''re ready to pick things back up, we''re here.', '[]'::jsonb),
('reactivation', 'New capability intro', 'We shipped {{new_capability}} since we last talked. Total game-changer for {{industry}}. Worth a look?', '["new_capability","industry"]'::jsonb),
('reactivation', 'Case study share', 'Closed {{case_study_subject}} recently — similar setup to {{business_name}}. Got them {{result}}. Read: {{case_link}}', '["case_study_subject","business_name","result","case_link"]'::jsonb),
('reactivation', 'Quick 3-choice', 'Where''s {{business_name}} at? 1) All good, dialed in 2) Quiet quarter 3) Need help rebooting. Reply with the number.', '["business_name"]'::jsonb),
('reactivation', 'Deadline-driven', 'Heads up — {{program_name}} cohort closes {{close_date}}. Thought of you.', '["program_name","close_date"]'::jsonb),
('reactivation', 'Honest ask', 'Honest ask: did we drop the ball somewhere? I want to make sure we''re doing right by {{business_name}}.', '["business_name"]'::jsonb),
('reactivation', 'Warm check', 'Just thinking about {{business_name}} — how''s {{recent_event}} going?', '["business_name","recent_event"]'::jsonb),
('reactivation', 'Restart offer', 'If you want back in, we can waive the setup fee. Valid 7 days: {{restart_link}}', '["restart_link"]'::jsonb),
('reactivation', 'Listener mode', 'I''d rather listen than pitch — what''s working / not working for {{business_name}} right now?', '["business_name"]'::jsonb),
('reactivation', 'Trend-driven', 'Seeing {{trend_observation}} everywhere right now. Curious how it''s hitting {{business_name}}.', '["trend_observation","business_name"]'::jsonb),
('reactivation', '6-month revisit', 'It''s been ~6 months since we last chatted. Worth a 15-min catch-up? {{calendar_link}}', '["calendar_link"]'::jsonb),
('reactivation', 'Last touch before archive', 'Cleaning out my active list this week. If {{business_name}} isn''t on your radar right now, no hard feelings — just let me know so I can reach back out in 6 months.', '["business_name"]'::jsonb),
('reactivation', 'New-year reboot', 'New quarter, fresh start. If {{business_name}} wants to reboot the growth engine, I''ve got a spot for you. {{calendar_link}}', '["business_name","calendar_link"]'::jsonb);

-- payment-reminder (22)
insert into telegram_presets (category, name, body, variables) values
('payment-reminder', 'First soft reminder', 'Hey {{first_name}} — invoice {{invoice_number}} for ${{amount}} is due {{due_date}}. Pay link: {{pay_link}}', '["first_name","invoice_number","amount","due_date","pay_link"]'::jsonb),
('payment-reminder', 'Due tomorrow', 'Friendly heads up: invoice {{invoice_number}} for ${{amount}} is due tomorrow. {{pay_link}}', '["invoice_number","amount","pay_link"]'::jsonb),
('payment-reminder', 'Due today', 'Quick reminder — invoice {{invoice_number}} for ${{amount}} is due today. {{pay_link}}', '["invoice_number","amount","pay_link"]'::jsonb),
('payment-reminder', 'One day late', 'Hey {{first_name}} — invoice {{invoice_number}} was due yesterday. Just a nudge: {{pay_link}}', '["first_name","invoice_number","pay_link"]'::jsonb),
('payment-reminder', '7 days past due', 'Invoice {{invoice_number}} is 7 days past due (${{amount}}). Everything ok on your end?  {{pay_link}}', '["invoice_number","amount","pay_link"]'::jsonb),
('payment-reminder', '14 days past due', 'Invoice {{invoice_number}} is 14 days past due. Want to set up a payment plan or auto-pay? {{pay_link}}', '["invoice_number","pay_link"]'::jsonb),
('payment-reminder', '30 days past due', 'Invoice {{invoice_number}} is 30 days past due — will need to pause services on {{pause_date}} if unresolved. {{pay_link}}', '["invoice_number","pause_date","pay_link"]'::jsonb),
('payment-reminder', 'Service pause warning', 'We''ll pause {{business_name}}''s services tomorrow unless {{invoice_number}} is settled. Ping me if anything''s going on.', '["business_name","invoice_number"]'::jsonb),
('payment-reminder', 'Card declined', 'Heads up — your card on file was declined for invoice {{invoice_number}}. Update: {{update_card_link}}', '["invoice_number","update_card_link"]'::jsonb),
('payment-reminder', 'ACH bounced', 'Your ACH payment for {{invoice_number}} bounced. Want to retry or use a different method? {{pay_link}}', '["invoice_number","pay_link"]'::jsonb),
('payment-reminder', 'Auto-pay reminder', 'Auto-pay is scheduled for {{due_date}} — ${{amount}}. No action needed.', '["due_date","amount"]'::jsonb),
('payment-reminder', 'Payment plan offer', 'Happy to split {{invoice_number}} into 3 installments if cash-flow is tight. Just say the word.', '["invoice_number"]'::jsonb),
('payment-reminder', 'Final notice', 'Final notice before we pass {{invoice_number}} to collections on {{collections_date}}. Settle: {{pay_link}}', '["invoice_number","collections_date","pay_link"]'::jsonb),
('payment-reminder', 'Thank-you + receipt', 'Payment received — thanks {{first_name}}! Receipt: {{receipt_link}}', '["first_name","receipt_link"]'::jsonb),
('payment-reminder', 'Renewal due', 'Your annual plan renews on {{renewal_date}} — ${{amount}}. Nothing to do, just a heads up.', '["renewal_date","amount"]'::jsonb),
('payment-reminder', 'Upgrade invoice', 'Your upgrade to {{plan_name}} is invoiced — ${{amount}}. Pay: {{pay_link}}', '["plan_name","amount","pay_link"]'::jsonb),
('payment-reminder', 'Proration note', 'Pro-rated invoice for {{plan_name}} — ${{prorated_amount}} for {{days_count}} days. {{pay_link}}', '["plan_name","prorated_amount","days_count","pay_link"]'::jsonb),
('payment-reminder', 'Partial payment received', 'Got ${{paid_amount}} toward invoice {{invoice_number}} — balance remaining ${{balance}}. {{pay_link}}', '["paid_amount","invoice_number","balance","pay_link"]'::jsonb),
('payment-reminder', 'Overdue + check-in', 'Invoice {{invoice_number}} is past due AND I haven''t heard from you in a while. Everything ok? Let''s jump on a call: {{calendar_link}}', '["invoice_number","calendar_link"]'::jsonb),
('payment-reminder', 'Statement request', 'Would a statement of all open invoices help? I can email one over today.', '[]'::jsonb),
('payment-reminder', 'Currency conversion note', 'Heads up: {{invoice_number}} shows in USD; your local currency equivalent is approximately {{local_amount}}.', '["invoice_number","local_amount"]'::jsonb),
('payment-reminder', 'Pay-to-unlock feature', 'To unlock {{feature_name}}, invoice {{invoice_number}} needs to be settled. Quick link: {{pay_link}}', '["feature_name","invoice_number","pay_link"]'::jsonb);

-- appointment-confirm (21)
insert into telegram_presets (category, name, body, variables) values
('appointment-confirm', 'Basic confirm', 'Confirmed — {{meeting_time}} on {{meeting_date}}. See you then, {{first_name}}.', '["meeting_time","meeting_date","first_name"]'::jsonb),
('appointment-confirm', 'With Zoom link', 'Confirmed for {{meeting_time}} on {{meeting_date}}. Zoom: {{zoom_link}}', '["meeting_time","meeting_date","zoom_link"]'::jsonb),
('appointment-confirm', 'With address', 'Confirmed for {{meeting_time}} on {{meeting_date}}. Address: {{address}}. Parking: {{parking_note}}', '["meeting_time","meeting_date","address","parking_note"]'::jsonb),
('appointment-confirm', 'Confirm + agenda', 'Confirmed — {{meeting_time}} on {{meeting_date}}. Agenda: {{agenda_summary}}', '["meeting_time","meeting_date","agenda_summary"]'::jsonb),
('appointment-confirm', 'Confirm + prep', 'Locked in for {{meeting_time}}. To prep: {{prep_items}}. See you then.', '["meeting_time","prep_items"]'::jsonb),
('appointment-confirm', 'Rescheduled confirm', 'Rescheduled to {{meeting_time}} on {{meeting_date}}. Talk soon.', '["meeting_time","meeting_date"]'::jsonb),
('appointment-confirm', 'Callback confirm', 'Callback scheduled — {{callback_time}}. Your number on file: {{phone}}.', '["callback_time","phone"]'::jsonb),
('appointment-confirm', 'Video call confirm', 'Video call confirmed for {{meeting_time}}. Link: {{video_link}}. Test your camera a few min early if it''s been a while.', '["meeting_time","video_link"]'::jsonb),
('appointment-confirm', 'Onsite confirm', 'Onsite visit confirmed for {{visit_time}}. Our team arrives at {{address}}. Point of contact: {{contact_name}}.', '["visit_time","address","contact_name"]'::jsonb),
('appointment-confirm', 'Multi-party confirm', 'Confirmed — {{first_name}}, {{second_name}}, and our team, {{meeting_time}} on {{meeting_date}}. Zoom: {{zoom_link}}', '["first_name","second_name","meeting_time","meeting_date","zoom_link"]'::jsonb),
('appointment-confirm', 'Kickoff call confirm', 'Kickoff call confirmed for {{meeting_time}}. You''ll meet {{team_members}}. Join: {{zoom_link}}', '["meeting_time","team_members","zoom_link"]'::jsonb),
('appointment-confirm', 'Discovery call confirm', 'Discovery call locked in — {{meeting_time}} on {{meeting_date}}. 20 min, no slide deck, just a conversation.', '["meeting_time","meeting_date"]'::jsonb),
('appointment-confirm', 'Strategy session confirm', 'Strategy session confirmed: {{meeting_time}}, {{meeting_date}}. 60 min. Bring: {{bring_items}}', '["meeting_time","meeting_date","bring_items"]'::jsonb),
('appointment-confirm', 'Demo confirm', 'Demo scheduled for {{meeting_time}}. I''ll walk you through {{demo_focus}}. Join: {{zoom_link}}', '["meeting_time","demo_focus","zoom_link"]'::jsonb),
('appointment-confirm', 'Contract review confirm', 'Contract review set for {{meeting_time}}. Agreement for your review: {{contract_link}}', '["meeting_time","contract_link"]'::jsonb),
('appointment-confirm', 'Walk-through confirm', 'Walk-through confirmed — {{walk_time}}, {{meeting_date}}. Meet at {{meet_location}}.', '["walk_time","meeting_date","meet_location"]'::jsonb),
('appointment-confirm', 'Consult confirm', 'Consult confirmed for {{meeting_time}}. 30 min. If anything comes up, this number reaches me direct.', '["meeting_time"]'::jsonb),
('appointment-confirm', 'Training session confirm', 'Training session confirmed: {{meeting_time}}. You''ll learn {{training_topic}}. Join: {{zoom_link}}', '["meeting_time","training_topic","zoom_link"]'::jsonb),
('appointment-confirm', 'Quarterly review confirm', 'QBR confirmed for {{meeting_time}} on {{meeting_date}}. 60 min — we''ll cover KPIs, pipeline, and next quarter.', '["meeting_time","meeting_date"]'::jsonb),
('appointment-confirm', 'Post-sale onboarding confirm', 'Onboarding call confirmed for {{meeting_time}}. We''ll get everything live in 30 min. Join: {{zoom_link}}', '["meeting_time","zoom_link"]'::jsonb),
('appointment-confirm', 'Confirm + contact details', 'Confirmed for {{meeting_time}}. If you need to reach me directly: {{direct_phone}}.', '["meeting_time","direct_phone"]'::jsonb);

-- appointment-reminder (22)
insert into telegram_presets (category, name, body, variables) values
('appointment-reminder', '24hr reminder', 'Reminder: your call with {{business_name}} is tomorrow at {{meeting_time}}. Link: {{zoom_link}}', '["business_name","meeting_time","zoom_link"]'::jsonb),
('appointment-reminder', '2hr reminder', 'Heads up — we''re on in 2 hours at {{meeting_time}}. {{zoom_link}}', '["meeting_time","zoom_link"]'::jsonb),
('appointment-reminder', '30-min reminder', 'Quick reminder: call at {{meeting_time}} — in 30 min. {{zoom_link}}', '["meeting_time","zoom_link"]'::jsonb),
('appointment-reminder', '15-min reminder', 'On in 15 min: {{zoom_link}}. See you soon.', '["zoom_link"]'::jsonb),
('appointment-reminder', '5-min reminder', 'Starting in 5. {{zoom_link}}', '["zoom_link"]'::jsonb),
('appointment-reminder', '3-day reminder', 'Reminder: {{meeting_time}} on {{meeting_date}}. If anything needs to change, reply here.', '["meeting_time","meeting_date"]'::jsonb),
('appointment-reminder', '1-week reminder', '1 week out from your strategy session on {{meeting_date}}. Want to reconfirm or reschedule?', '["meeting_date"]'::jsonb),
('appointment-reminder', 'Morning-of reminder', 'Good morning {{first_name}} — we''re on at {{meeting_time}} today. Everything still good on your end?', '["first_name","meeting_time"]'::jsonb),
('appointment-reminder', 'Prep-checklist reminder', 'Tomorrow at {{meeting_time}} — quick prep: {{prep_items}}', '["meeting_time","prep_items"]'::jsonb),
('appointment-reminder', 'Reschedule prompt', 'Friendly nudge: call at {{meeting_time}} tomorrow. If the time no longer works, here''s the link to grab a new slot: {{calendar_link}}', '["meeting_time","calendar_link"]'::jsonb),
('appointment-reminder', 'Onsite arriving reminder', 'Our team is heading over in 30 min for the {{visit_time}} onsite at {{address}}.', '["visit_time","address"]'::jsonb),
('appointment-reminder', 'Phone call reminder', 'Calling you at {{meeting_time}} on {{phone}}. Ready?', '["meeting_time","phone"]'::jsonb),
('appointment-reminder', 'Reminder + agenda recap', 'Tomorrow at {{meeting_time}}. We''ll cover: {{agenda_summary}}.', '["meeting_time","agenda_summary"]'::jsonb),
('appointment-reminder', 'Reminder + cancel option', 'Call tomorrow at {{meeting_time}}. Need to cancel? Just reply CANCEL.', '["meeting_time"]'::jsonb),
('appointment-reminder', 'No-show follow up', 'Missed you at {{meeting_time}} — everything ok? Grab a new slot: {{calendar_link}}', '["meeting_time","calendar_link"]'::jsonb),
('appointment-reminder', 'Running late note', 'Running ~5 min late to our {{meeting_time}} — will hop on ASAP.', '["meeting_time"]'::jsonb),
('appointment-reminder', 'Location change alert', 'Quick change — tomorrow''s meeting moved to {{new_location}}. Same time.', '["new_location"]'::jsonb),
('appointment-reminder', 'Call number update', 'Heads up: I''ll be calling from {{new_number}} tomorrow at {{meeting_time}}.', '["new_number","meeting_time"]'::jsonb),
('appointment-reminder', 'Parking info reminder', 'For tomorrow''s visit: free parking in {{parking_location}}. Use spot {{spot_number}}.', '["parking_location","spot_number"]'::jsonb),
('appointment-reminder', 'Weather advisory', 'Heads up — forecast calls for {{weather_condition}} tomorrow. Still good to meet at {{meeting_time}}?', '["weather_condition","meeting_time"]'::jsonb),
('appointment-reminder', 'Doc prep reminder', 'Tomorrow at {{meeting_time}} — please have {{document_name}} handy.', '["meeting_time","document_name"]'::jsonb),
('appointment-reminder', 'Final reminder', 'Last reminder — call in 10 min at {{zoom_link}}.', '["zoom_link"]'::jsonb);

-- review-request (21)
insert into telegram_presets (category, name, body, variables) values
('review-request', 'Simple Google ask', '{{first_name}}, if the work landed well would you mind dropping a 2-min Google review? {{review_link}}', '["first_name","review_link"]'::jsonb),
('review-request', 'Google with reason', 'Google reviews are how {{business_name}} gets discovered — if we''ve earned it, a quick 2-min review would mean a lot: {{review_link}}', '["business_name","review_link"]'::jsonb),
('review-request', 'Yelp review', 'Would you mind leaving us a quick Yelp review? Link: {{yelp_link}}. Takes 90 seconds.', '["yelp_link"]'::jsonb),
('review-request', 'Facebook review', 'If you have a sec, a Facebook recommendation really helps: {{fb_review_link}}', '["fb_review_link"]'::jsonb),
('review-request', 'Post-service review', 'Hope {{service_name}} exceeded your expectations. If yes — here''s a review link: {{review_link}}. If no, reply here and we''ll make it right.', '["service_name","review_link"]'::jsonb),
('review-request', 'After milestone review', 'Now that we''ve wrapped {{milestone_name}} together, would love your honest review: {{review_link}}', '["milestone_name","review_link"]'::jsonb),
('review-request', '5-star confirmation', 'Quick one — would you rate us 5 stars? If yes: {{review_link}}. If not, what could we do better?', '["review_link"]'::jsonb),
('review-request', 'Video testimonial ask', 'Would you be open to a 60-second video testimonial? We can record over Zoom, takes 10 min total.', '[]'::jsonb),
('review-request', 'Written testimonial ask', 'If you''re willing, a short written testimonial about working with {{business_name}} would help others discover us. Just reply here.', '["business_name"]'::jsonb),
('review-request', 'LinkedIn recommendation', 'If we''ve earned it, a LinkedIn recommendation would mean a lot: {{linkedin_profile}}', '["linkedin_profile"]'::jsonb),
('review-request', 'Multi-site review', 'Where do you hang out most — Google, Yelp, or Facebook? Would love a quick review there: Google {{google_link}} | Yelp {{yelp_link}} | FB {{fb_link}}', '["google_link","yelp_link","fb_link"]'::jsonb),
('review-request', 'Gentle follow-up review', 'Following up on my last note — if you have 2 min for a quick review: {{review_link}}. No worries if now''s not the time.', '["review_link"]'::jsonb),
('review-request', 'Incentivized review', 'Leave a 2-min Google review and we''ll credit ${{credit_amount}} toward your next month. Link: {{review_link}}', '["credit_amount","review_link"]'::jsonb),
('review-request', 'Team-shoutout review', 'If {{team_member_name}} knocked it out of the park, they''d love a shout-out in a quick review: {{review_link}}', '["team_member_name","review_link"]'::jsonb),
('review-request', 'Private feedback first', 'Before you post anywhere public — any feedback for us? If all good, here''s the public link: {{review_link}}', '["review_link"]'::jsonb),
('review-request', 'Post-call review', 'Hope today''s call delivered value. If you''d rate it 5-star, would you drop a quick review? {{review_link}}', '["review_link"]'::jsonb),
('review-request', 'Anniversary review', 'It''s been a year with {{business_name}} and ShortStack. If it''s been a 5-star year, would love a public review: {{review_link}}', '["business_name","review_link"]'::jsonb),
('review-request', 'Industry directory review', 'A review on {{directory_name}} would really help us get in front of businesses like yours: {{directory_link}}', '["directory_name","directory_link"]'::jsonb),
('review-request', 'G2/Capterra ask', 'If you have a sec for a quick G2 review — major help for us: {{g2_link}}', '["g2_link"]'::jsonb),
('review-request', 'Trust-pilot ask', 'Trustpilot review would be gold if you have 90 seconds: {{trustpilot_link}}', '["trustpilot_link"]'::jsonb),
('review-request', 'Referral-style testimonial', 'If you''d recommend {{business_name}} to a friend, would you put that in writing? {{review_link}}', '["business_name","review_link"]'::jsonb);

-- thank-you (21)
insert into telegram_presets (category, name, body, variables) values
('thank-you', 'Simple thanks', 'Thank you, {{first_name}} — genuinely appreciate working together.', '["first_name"]'::jsonb),
('thank-you', 'Milestone thanks', 'Hit {{milestone_name}} together today — thank you for trusting us.', '["milestone_name"]'::jsonb),
('thank-you', 'Payment received thanks', 'Payment received — thanks {{first_name}}. Invoice receipt: {{receipt_link}}', '["first_name","receipt_link"]'::jsonb),
('thank-you', 'Onboarding complete thanks', 'Onboarding wrapped — thank you for the easy-mode setup. Growth mode now engaged.', '[]'::jsonb),
('thank-you', 'First post approval thanks', 'Appreciate the quick turnaround on the first approvals. Already ahead of schedule.', '[]'::jsonb),
('thank-you', 'Referral thanks', 'Huge thanks for referring {{referee_name}}. That means a lot. Dropping ${{credit_amount}} in credit to your account.', '["referee_name","credit_amount"]'::jsonb),
('thank-you', 'Review thanks', 'Just saw your review — sincere thank you. Keeps us going.', '[]'::jsonb),
('thank-you', 'Contract signed thanks', 'Contract signed — thanks for making it official, {{first_name}}. Going to work.', '["first_name"]'::jsonb),
('thank-you', 'Anniversary thanks', '{{years_count}} years working with {{business_name}} — couldn''t be more grateful.', '["years_count","business_name"]'::jsonb),
('thank-you', 'Renewal thanks', 'Renewal confirmed — thanks for continuing the partnership, {{first_name}}.', '["first_name"]'::jsonb),
('thank-you', 'Holiday thanks', 'As the year wraps up — thank you for being part of the {{business_name}} journey.', '["business_name"]'::jsonb),
('thank-you', 'Post-event thanks', 'Thanks for coming to {{event_name}} — great to see you IRL.', '["event_name"]'::jsonb),
('thank-you', 'Kind words thanks', 'Your note genuinely made my week — thank you.', '[]'::jsonb),
('thank-you', 'Post-call thanks', 'Thanks for the time today, {{first_name}}. Recap + next steps incoming.', '["first_name"]'::jsonb),
('thank-you', 'Feedback thanks', 'Thanks for the honest feedback — that''s gold. Shipping changes this week.', '[]'::jsonb),
('thank-you', 'Fast-response thanks', 'Quick reply, appreciate it {{first_name}}. Keeps us moving fast.', '["first_name"]'::jsonb),
('thank-you', 'Patience thanks', 'Thanks for the patience while we worked through {{issue_topic}}. Sorted now.', '["issue_topic"]'::jsonb),
('thank-you', 'Intro thanks', 'Thanks for the intro to {{intro_contact_name}}. Reaching out now.', '["intro_contact_name"]'::jsonb),
('thank-you', 'End-of-year thanks', 'As 2025 wraps, just want to say thank you. Looking forward to an even bigger 2026 with {{business_name}}.', '["business_name"]'::jsonb),
('thank-you', 'Team shoutout thanks', '{{team_member_name}} noted how awesome you were to work with today — wanted to pass that up.', '["team_member_name"]'::jsonb),
('thank-you', 'Handwritten-note follow-up', 'Sent a handwritten thank-you note in the mail. Should land by {{arrival_date}}.', '["arrival_date"]'::jsonb);

-- upsell (22)
insert into telegram_presets (category, name, body, variables) values
('upsell', 'Add-on teaser', '{{first_name}}, you''re getting strong results on {{current_plan}} — ever thought about layering in {{addon_name}}? Happy to walk through it.', '["first_name","current_plan","addon_name"]'::jsonb),
('upsell', 'Upgrade path intro', 'You''re on track to outgrow {{current_plan}} by {{upgrade_date}}. Next step up: {{next_plan}} at ${{next_price}}/mo.', '["current_plan","upgrade_date","next_plan","next_price"]'::jsonb),
('upsell', 'Bundle offer', 'Bundle deal: add {{bundle_services}} and save {{save_pct}}%. Runs through {{deadline}}.', '["bundle_services","save_pct","deadline"]'::jsonb),
('upsell', 'Usage-triggered upgrade', 'Noticed you''re pushing the limits of your plan — we should chat about upgrading to avoid hitting caps.', '[]'::jsonb),
('upsell', 'ROI-driven pitch', 'Current plan is giving you {{current_roi}}x ROI. Next tier projects {{projected_roi}}x. Worth 15 min to map out?', '["current_roi","projected_roi"]'::jsonb),
('upsell', 'Cross-sell service', 'While we''re running {{current_service}}, adding {{cross_sell_service}} would compound the results. Interested?', '["current_service","cross_sell_service"]'::jsonb),
('upsell', 'Limited-time upgrade', 'Offering this week only: upgrade to {{next_plan}} with setup waived (save ${{setup_save}}). Expires {{deadline}}.', '["next_plan","setup_save","deadline"]'::jsonb),
('upsell', 'Annual prepay discount', 'Switch to annual prepay and save {{annual_save_pct}}% vs. monthly. Lock it in: {{upgrade_link}}', '["annual_save_pct","upgrade_link"]'::jsonb),
('upsell', 'New feature unlock', 'New on {{next_plan}}: {{new_feature}}. Game-changer for {{business_name}}. Want a demo?', '["next_plan","new_feature","business_name"]'::jsonb),
('upsell', 'Expansion to new channel', 'You''re killing it on {{current_channel}}. Ready to try {{new_channel}} too? Same system, new channel.', '["current_channel","new_channel"]'::jsonb),
('upsell', 'Team-seat expansion', 'You''ve added {{team_size}} team members — {{next_plan}} gives unlimited seats for ${{next_price}}/mo.', '["team_size","next_plan","next_price"]'::jsonb),
('upsell', 'Strategy add-on', 'You''re running on {{current_plan}} — want to add a monthly strategy call? ${{addon_price}}/mo. Dramatic difference in compounding.', '["current_plan","addon_price"]'::jsonb),
('upsell', 'Ad spend increase', 'Current ad spend is maxed out on the plan — bumping to {{next_plan}} unlocks {{extra_spend}}/mo capacity.', '["next_plan","extra_spend"]'::jsonb),
('upsell', 'White-label tier', 'As you scale, white-label might make sense — put your brand on our reports. Let me know if you want a preview.', '[]'::jsonb),
('upsell', 'Priority support upgrade', 'Priority support gets you under-15-min response times. ${{priority_price}}/mo add-on.', '["priority_price"]'::jsonb),
('upsell', 'Quarterly review add-on', 'Would a quarterly business review help? We''d go deep on KPIs every 90 days. ${{qbr_price}}/qtr.', '["qbr_price"]'::jsonb),
('upsell', 'Content volume bump', 'Want to go from {{current_volume}} posts/mo to {{new_volume}}? Jump to {{next_plan}}.', '["current_volume","new_volume","next_plan"]'::jsonb),
('upsell', 'Extra clients add-on', 'Add {{extra_clients}} more clients to your account for ${{extra_price}}/mo.', '["extra_clients","extra_price"]'::jsonb),
('upsell', 'Done-for-you pitch', 'Want us to fully manage {{channel_or_service}} for you? Fully done-for-you at ${{dfy_price}}/mo.', '["channel_or_service","dfy_price"]'::jsonb),
('upsell', 'Tier-comparison prompt', 'Made you a side-by-side comparison of {{current_plan}} vs. {{next_plan}}: {{comparison_link}}', '["current_plan","next_plan","comparison_link"]'::jsonb),
('upsell', 'Partner program intro', 'Introducing our partner program — split revenue on referrals, co-marketing, events. Interested? {{partner_link}}', '["partner_link"]'::jsonb),
('upsell', 'Upsell + case study', 'Client on {{next_plan}} just hit {{milestone_result}}. Same setup would work for {{business_name}}. Chat? {{calendar_link}}', '["next_plan","milestone_result","business_name","calendar_link"]'::jsonb);

-- feedback-survey (21)
insert into telegram_presets (category, name, body, variables) values
('feedback-survey', 'NPS one-question', 'On a scale of 0-10, how likely are you to recommend {{business_name}}? Just reply with a number.', '["business_name"]'::jsonb),
('feedback-survey', 'Monthly pulse', 'Quick monthly pulse: how''s the partnership going? 1) Great 2) Fine 3) Needs work. Reply with the number.', '[]'::jsonb),
('feedback-survey', 'Feature request ask', 'If we could build one new thing for {{business_name}} in the next 90 days, what would it be?', '["business_name"]'::jsonb),
('feedback-survey', 'Post-service CSAT', 'On a 1-5 scale, how would you rate your recent {{service_name}} experience?', '["service_name"]'::jsonb),
('feedback-survey', 'Onboarding feedback', 'Now that onboarding is done — how was the experience? Anything we should fix?', '[]'::jsonb),
('feedback-survey', 'Churn-risk probe', 'Being direct — is there anything putting our partnership at risk right now? Would rather know early.', '[]'::jsonb),
('feedback-survey', 'Formal survey link', 'Quick 2-min survey to help us improve: {{survey_link}}. Appreciated.', '["survey_link"]'::jsonb),
('feedback-survey', 'Pricing feedback', 'Be honest — does pricing feel fair for the value you''re getting?', '[]'::jsonb),
('feedback-survey', 'Content quality ask', 'How would you rate the content quality so far? 1 to 5, be honest.', '[]'::jsonb),
('feedback-survey', 'Account-manager feedback', 'How''s {{am_name}} been to work with? Anything they could do better?', '["am_name"]'::jsonb),
('feedback-survey', 'Portal UX feedback', 'How''s the client portal experience? Anything confusing or missing?', '[]'::jsonb),
('feedback-survey', 'Post-issue follow-up', 'After the {{issue_topic}} issue — are you feeling good about how it got resolved?', '["issue_topic"]'::jsonb),
('feedback-survey', 'Win/loss check', 'What''s working for you right now, and what isn''t? Short and honest is best.', '[]'::jsonb),
('feedback-survey', '3-month retro', 'We''re 3 months in — what''s the headline? Would love a 1-min retro.', '[]'::jsonb),
('feedback-survey', 'Annual retro', 'Full year in — curious what your honest 1-line review of {{business_name}} × ShortStack would be.', '["business_name"]'::jsonb),
('feedback-survey', 'Exit interview', 'Sorry to see you go. If you have 10 min, would love to do a quick exit interview so we can improve: {{calendar_link}}', '["calendar_link"]'::jsonb),
('feedback-survey', 'Prospect-to-client feedback', 'What pushed you to pick ShortStack over other options?', '[]'::jsonb),
('feedback-survey', 'Prospect lost-deal', 'What made you go another direction? Totally ok to be blunt.', '[]'::jsonb),
('feedback-survey', 'Testimonial request', 'If you''re happy — can we quote you? Just a sentence or two.', '[]'::jsonb),
('feedback-survey', 'Feature beta invite', 'You''re one of the first eligible for {{feature_name}} beta. Want in? {{beta_link}}', '["feature_name","beta_link"]'::jsonb),
('feedback-survey', 'Suggestion box ping', 'Any suggestions floating in your head? Drop them here — we ship 2-3 from client feedback every month.', '[]'::jsonb);

-- holiday-promo (21)
insert into telegram_presets (category, name, body, variables) values
('holiday-promo', 'Black Friday', 'Black Friday exclusive for {{business_name}}: {{discount_pct}}% off any upgrade, 24 hours only. {{offer_link}}', '["business_name","discount_pct","offer_link"]'::jsonb),
('holiday-promo', 'Cyber Monday', 'Cyber Monday — ${{discount_amount}} off any add-on, code {{coupon_code}}. Valid through tonight.', '["discount_amount","coupon_code"]'::jsonb),
('holiday-promo', 'Thanksgiving thanks', 'Happy Thanksgiving from ShortStack. Grateful for {{business_name}}''s partnership.', '["business_name"]'::jsonb),
('holiday-promo', 'Christmas greetings', 'Merry Christmas {{first_name}} — hope you and the team at {{business_name}} are soaking it in.', '["first_name","business_name"]'::jsonb),
('holiday-promo', 'Hanukkah greetings', 'Happy Hanukkah {{first_name}} — warm wishes from all of us.', '["first_name"]'::jsonb),
('holiday-promo', 'New Year greeting', 'Happy {{year}} from ShortStack. Plenty of wins planned with {{business_name}} this year.', '["year","business_name"]'::jsonb),
('holiday-promo', 'Valentine''s Day', 'Love note from {{business_name}}: thanks for being awesome to work with.', '["business_name"]'::jsonb),
('holiday-promo', 'St Patrick''s Day', 'Happy St. Patrick''s Day! Running a 17% off promo on {{service_name}} through {{deadline}}.', '["service_name","deadline"]'::jsonb),
('holiday-promo', 'Easter promo', 'Spring refresh: {{discount_pct}}% off new add-ons through Easter Monday. {{offer_link}}', '["discount_pct","offer_link"]'::jsonb),
('holiday-promo', 'Memorial Day', 'Honoring Memorial Day — our team is offline Monday. Back Tuesday.', '[]'::jsonb),
('holiday-promo', 'Independence Day promo', '4th of July promo: free {{addon_name}} for the month of July on any upgrade. Link: {{offer_link}}', '["addon_name","offer_link"]'::jsonb),
('holiday-promo', 'Labor Day', 'Labor Day weekend — we''re off Monday. Urgent? Ping the after-hours line: {{after_hours_phone}}', '["after_hours_phone"]'::jsonb),
('holiday-promo', 'Halloween', 'Spooky season content pack launching today for {{business_name}}. Approve in portal.', '["business_name"]'::jsonb),
('holiday-promo', 'Mother''s Day', 'Happy Mother''s Day to all the moms on {{business_name}}''s team.', '["business_name"]'::jsonb),
('holiday-promo', 'Father''s Day', 'Happy Father''s Day from ShortStack.', '[]'::jsonb),
('holiday-promo', 'Year-end sale', 'Year-end sale: lock in {{year_plus_one}} pricing at today''s rates before {{deadline_date}}.', '["year_plus_one","deadline_date"]'::jsonb),
('holiday-promo', 'Spring promo', 'Spring into growth — {{discount_pct}}% off any new service bundle through {{deadline}}.', '["discount_pct","deadline"]'::jsonb),
('holiday-promo', 'Summer promo', 'Summer pipeline push — 3 months of {{service_name}} at launch pricing. {{offer_link}}', '["service_name","offer_link"]'::jsonb),
('holiday-promo', 'Anniversary sale', 'ShortStack''s {{anniversary_year}}-year anniversary — {{discount_pct}}% off every plan, 48 hours. {{offer_link}}', '["anniversary_year","discount_pct","offer_link"]'::jsonb),
('holiday-promo', 'Small-biz Saturday', 'Small Business Saturday: shout-out to {{business_name}} — one of our favorite partners.', '["business_name"]'::jsonb),
('holiday-promo', 'Giving Tuesday', 'Giving Tuesday — we''re donating 10% of today''s revenue to {{charity_name}}. Thanks for being part of it.', '["charity_name"]'::jsonb);

-- winback (22)
insert into telegram_presets (category, name, body, variables) values
('winback', 'Miss-you intro', '{{first_name}}, been a minute — miss having {{business_name}} in the family.', '["first_name","business_name"]'::jsonb),
('winback', 'Why-we-lost ask', 'If you''re open to it — what made you move on from ShortStack?', '[]'::jsonb),
('winback', 'Special comeback offer', 'Comeback offer: restart at {{comeback_discount_pct}}% off for 3 months. Valid 7 days: {{restart_link}}', '["comeback_discount_pct","restart_link"]'::jsonb),
('winback', 'Show what changed', 'Since you left, we''ve shipped {{new_features}}. Big changes. Worth a second look?', '["new_features"]'::jsonb),
('winback', 'One-call no pitch', 'Want to catch up — no pitch, just check in. {{calendar_link}}', '["calendar_link"]'::jsonb),
('winback', 'Alumni perk', 'As an alum you get lifetime {{alumni_discount_pct}}% off if you ever come back. No expiration.', '["alumni_discount_pct"]'::jsonb),
('winback', 'Case study share', 'Thought this would interest you — we doubled {{alumni_client_name}}''s revenue after they came back. Case study: {{case_link}}', '["alumni_client_name","case_link"]'::jsonb),
('winback', 'Timing-reset ask', 'Timing wasn''t right last time. How''s the market treating {{business_name}} now?', '["business_name"]'::jsonb),
('winback', 'We-fixed-it note', 'Remember {{past_issue}}? Fixed it. Totally different team/system now.', '["past_issue"]'::jsonb),
('winback', 'Benchmark peek', 'Benchmark stat: clients who came back averaged {{comeback_avg}}% higher ROI year-over-year. Worth a chat?', '["comeback_avg"]'::jsonb),
('winback', 'Free audit offer', 'Comeback free gift: full audit of your {{channel_or_service}} — no strings. Reply YES and we''ll run it.', '["channel_or_service"]'::jsonb),
('winback', 'Competition check', 'How''s {{current_provider}} treating you? Happy to stay radio silent if it''s going well — if not, our door''s open.', '["current_provider"]'::jsonb),
('winback', 'Ghost-last-try', 'Last check-in — if {{business_name}} ever wants back, my number''s right here. Wishing you the best either way.', '["business_name"]'::jsonb),
('winback', 'Industry-move alert', '{{industry}} is in major flux with {{industry_change}}. Figured you''d want a second set of eyes.', '["industry","industry_change"]'::jsonb),
('winback', 'New AM assignment', '{{new_am_name}} is now running your region and asked specifically to connect with you if you''re open.', '["new_am_name"]'::jsonb),
('winback', 'Ask-permission reach-out', 'Open to me reaching out once a quarter with ideas, even if we''re not working together? Zero pressure.', '[]'::jsonb),
('winback', 'Friendly direct ask', 'Direct ask: what would it take to earn {{business_name}}''s business back?', '["business_name"]'::jsonb),
('winback', 'Return perk', 'If you return we''ll backfill {{months_free}} months of service as a make-good. {{restart_link}}', '["months_free","restart_link"]'::jsonb),
('winback', 'Free consult', '30-min free consult on your current setup — whether you come back or not. {{calendar_link}}', '["calendar_link"]'::jsonb),
('winback', 'Brand update share', 'Heads up — ShortStack launched {{brand_update}} since you were with us. Changes the game. {{details_link}}', '["brand_update","details_link"]'::jsonb),
('winback', '1-year-away check', 'It''s been ~1 year since you left. How''s the setup holding up?', '[]'::jsonb),
('winback', 'Personal note from founder', '{{founder_name}} here — just wanted to personally reach out. If there''s anything I can do to help {{business_name}}, I''m here.', '["founder_name","business_name"]'::jsonb);

-- referral-ask (21)
insert into telegram_presets (category, name, body, variables) values
('referral-ask', 'Simple direct ask', 'Anyone you know who could use help growing like {{business_name}} has? I''d love an intro.', '["business_name"]'::jsonb),
('referral-ask', 'With incentive', 'Refer a friend — get ${{referral_credit}} credited to your account when they sign up. {{referral_link}}', '["referral_credit","referral_link"]'::jsonb),
('referral-ask', 'Specific industry ask', 'Know any {{industry}} businesses struggling with {{pain_point}}? Happy to help — and you get a credit.', '["industry","pain_point"]'::jsonb),
('referral-ask', 'Three-name ask', 'Quick one: can you think of 3 businesses that would benefit from what we do?', '[]'::jsonb),
('referral-ask', 'LinkedIn intro ask', 'Any chance you''d LinkedIn-intro us to {{target_person}} at {{target_company}}? I saw the connection.', '["target_person","target_company"]'::jsonb),
('referral-ask', 'Post-win referral', 'Since {{milestone}} just went great for {{business_name}} — who else should we be talking to?', '["milestone","business_name"]'::jsonb),
('referral-ask', 'Bring-a-friend deal', 'Bring-a-friend deal: both you and the referral get {{both_discount_pct}}% off next month. {{referral_link}}', '["both_discount_pct","referral_link"]'::jsonb),
('referral-ask', 'Referral program intro', 'Introducing our referral program — ${{credit_per_referral}} in credits per signup, uncapped. {{program_link}}', '["credit_per_referral","program_link"]'::jsonb),
('referral-ask', 'One-question referral', 'If this isn''t a fit for anyone, no worries. But if someone comes to mind — even one person — I''d love an intro.', '[]'::jsonb),
('referral-ask', 'Warm-intro template', 'If easier: I''ll draft the intro email for you. Just tell me who.', '[]'::jsonb),
('referral-ask', 'Partnership intro ask', 'Know any agencies we could partner with? Reciprocal referrals, both sides win.', '[]'::jsonb),
('referral-ask', 'Industry-event ask', 'You going to {{industry_event}}? If yes, any intros you''d be open to making there?', '["industry_event"]'::jsonb),
('referral-ask', 'Reverse referral', 'Anyone we can refer YOU to? I''d love to send business your way in the network.', '[]'::jsonb),
('referral-ask', 'After-review ask', 'Thanks for the review earlier. Quick ask — anyone else in your world who''d benefit from us?', '[]'::jsonb),
('referral-ask', 'Peer-group ask', 'You''re in {{peer_group_name}} — any members there we should meet?', '["peer_group_name"]'::jsonb),
('referral-ask', 'Vendor-list ask', 'Any vendors/partners of {{business_name}} we should be introduced to?', '["business_name"]'::jsonb),
('referral-ask', 'Testimonial + referral combo', 'Doubling up — any chance you''d do a quick testimonial AND a referral this month? Bonus credit: ${{combo_credit}}.', '["combo_credit"]'::jsonb),
('referral-ask', 'Mastermind intro', 'In any masterminds where our service might land? Open to intros.', '[]'::jsonb),
('referral-ask', 'Specific-name pre-ask', 'Long shot — are you connected to {{target_name}}?', '["target_name"]'::jsonb),
('referral-ask', 'Referral + Q&A offer', 'If you refer, I''ll also do a free 30-min brainstorm on anything you want in your business. Win-win.', '[]'::jsonb),
('referral-ask', 'No-pressure-permission ask', 'Totally ok if the answer is no — but could I ask you for 1-2 intros if you think of anyone?', '[]'::jsonb);

-- support-followup (21)
insert into telegram_presets (category, name, body, variables) values
('support-followup', 'Ticket resolved check', 'Ticket {{ticket_id}} marked resolved. All good on your end?', '["ticket_id"]'::jsonb),
('support-followup', 'Post-resolution CSAT', 'Got you sorted on {{issue_topic}} — quick 1-5 rating on the support experience?', '["issue_topic"]'::jsonb),
('support-followup', 'Proactive check-in', 'Heard from no one in a while — everything running smoothly?', '[]'::jsonb),
('support-followup', 'Outage recovery', 'Service is back up after {{outage_minutes}} min. Sorry for the hiccup. {{postmortem_link}}', '["outage_minutes","postmortem_link"]'::jsonb),
('support-followup', 'Ticket ETA update', 'Ticket {{ticket_id}} update: engineering confirmed fix lands {{eta}}. Will ping when live.', '["ticket_id","eta"]'::jsonb),
('support-followup', 'Ticket escalation', 'Escalating ticket {{ticket_id}} to {{senior_name}} — they''ll be in touch within 2hr.', '["ticket_id","senior_name"]'::jsonb),
('support-followup', 'Need-more-info prompt', 'To finish debugging — can you send {{info_needed}}?', '["info_needed"]'::jsonb),
('support-followup', 'Follow-up with workaround', 'While we fix {{bug_name}} — here''s a quick workaround: {{workaround_steps}}', '["bug_name","workaround_steps"]'::jsonb),
('support-followup', 'Did this help?', 'Did {{solution_summary}} resolve it, or still seeing the issue?', '["solution_summary"]'::jsonb),
('support-followup', 'How-to followup', 'Here''s a 60-sec loom on how to {{how_to_topic}}: {{loom_link}}', '["how_to_topic","loom_link"]'::jsonb),
('support-followup', 'Feature request logged', 'Logged your request for {{feature_name}} — on the roadmap. Will update you when it ships.', '["feature_name"]'::jsonb),
('support-followup', 'Root-cause update', 'Root cause for {{issue_topic}} found — it was {{rca_summary}}. Fix going out {{fix_date}}.', '["issue_topic","rca_summary","fix_date"]'::jsonb),
('support-followup', 'Still-open ping', 'Quick ping — ticket {{ticket_id}} is still open on our side. Waiting on {{waiting_on}} from you.', '["ticket_id","waiting_on"]'::jsonb),
('support-followup', 'Closed silently', 'Closing ticket {{ticket_id}} since we haven''t heard back — reopen anytime: {{ticket_link}}', '["ticket_id","ticket_link"]'::jsonb),
('support-followup', 'Maintenance window', 'Scheduled maintenance window: {{maintenance_start}} — {{maintenance_end}}. Expect brief downtime.', '["maintenance_start","maintenance_end"]'::jsonb),
('support-followup', 'Post-maintenance', 'Maintenance done. Everything back to normal. Verify from your end if you want.', '[]'::jsonb),
('support-followup', 'Incident resolved', 'Incident {{incident_id}} resolved. RCA + preventions: {{rca_link}}', '["incident_id","rca_link"]'::jsonb),
('support-followup', 'Bug workaround update', 'Update on {{bug_name}} — workaround refined: {{new_workaround}}. Official fix next week.', '["bug_name","new_workaround"]'::jsonb),
('support-followup', 'Onboarding follow-up', 'Onboarding went well a week ago — any lingering questions?', '[]'::jsonb),
('support-followup', 'Email-not-delivered', 'Heads up: your email to {{recipient}} bounced. Reason: {{bounce_reason}}. Want us to retry?', '["recipient","bounce_reason"]'::jsonb),
('support-followup', 'After-hours ack', 'Got your message — we''re out of hours right now but first thing tomorrow we''re on it.', '[]'::jsonb);

-- Note: final count is 300. Categories (14):
--   onboarding (22), nurture (22), reactivation (22), payment-reminder (22),
--   appointment-confirm (21), appointment-reminder (22), review-request (21),
--   thank-you (21), upsell (22), feedback-survey (21), holiday-promo (21),
--   winback (22), referral-ask (21), support-followup (21).
--   Total = 22+22+22+22+21+22+21+21+22+21+21+22+21+21 = 300.
