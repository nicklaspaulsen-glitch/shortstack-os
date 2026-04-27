/**
 * Real Estate vertical template.
 *
 * Pre-configured for residential agency owners working FSBO outreach,
 * expired listings, sphere-of-influence nurture, and buyer-seller match
 * pipelines. The content was distilled from the BiggerPockets/Tom Ferry
 * playbooks plus what's been observed working in our agency clients —
 * scripts here are intentionally direct, not "feature-y".
 */

import type { VerticalTemplate } from "./types";

export const REAL_ESTATE_TEMPLATE: VerticalTemplate = {
  vertical: "real_estate",
  display_name: "Real Estate Agencies",
  tagline: "FSBO outreach, listing alerts, mortgage funnels — day-one ready.",
  description:
    "Pre-configured ShortStack OS bundle for residential real estate agencies. Includes 5 lead-gen automations covering open-house RSVP, mortgage pre-approval, listing alerts, and buyer-seller matching. 10 SMS templates for showing reminders and contract follow-ups, 5 email templates for new listings and market updates, 3 cold-call scripts (FSBO, expired, SOI), urgency-based lead scoring, a 10-module Real Estate Lead-Gen Mastery course, and a 5-step funnel.",
  accent: "blue",
  icon: "Home",

  // ── 5 lead-gen automations ────────────────────────────────────────────
  automations: [
    {
      name: "Open House RSVP",
      description: "Captures open-house registrations and starts a 3-touch nurture.",
      trigger_event: "form_submit",
      trigger_filter: { form_type: "open_house" },
      actions: [
        { type: "send_email", template: "open_house_confirmation", delay_minutes: 0 },
        { type: "wait_hours", hours: 4 },
        { type: "send_sms", template: "open_house_reminder", delay_minutes: 0 },
        { type: "wait_days", days: 1 },
        { type: "send_email", template: "after_showing_followup", delay_minutes: 0 },
        { type: "tag_lead", tag: "open-house-attendee" },
      ],
    },
    {
      name: "Mortgage Pre-Approval Funnel",
      description: "Captures buyers who request a pre-approval check and routes to lender partner.",
      trigger_event: "form_submit",
      trigger_filter: { form_type: "preapproval" },
      actions: [
        { type: "send_email", template: "preapproval_intake", delay_minutes: 0 },
        { type: "tag_lead", tag: "needs-preapproval" },
        { type: "create_task", title: "Hand off to lender partner", due_in_hours: 24 },
        { type: "wait_days", days: 3 },
        { type: "send_sms", template: "preapproval_check_in", delay_minutes: 0 },
      ],
    },
    {
      name: "Listing Alerts (Saved Search)",
      description: "Drips matched listings to buyers with a saved search every 3 days.",
      trigger_event: "schedule_recurring",
      trigger_filter: { interval: "every_3_days", segment: "saved_search" },
      actions: [
        { type: "fetch_listings", source: "mls_saved_search" },
        { type: "send_email", template: "new_listings_for_you", delay_minutes: 0 },
        { type: "track_clicks", on_clicked: { tag_lead: "listing-clicked" } },
      ],
    },
    {
      name: "Buyer-Seller Match Notifier",
      description: "Pings the agent when a saved-search buyer matches a freshly listed property.",
      trigger_event: "listing_created",
      actions: [
        { type: "match_against_saved_searches" },
        { type: "send_internal_notification", channel: "agent_dm", template: "buyer_match_internal" },
        { type: "send_email", template: "we_found_your_match", delay_minutes: 0 },
      ],
    },
    {
      name: "Sphere of Influence Quarterly Touch",
      description: "Quarterly market-update + just-checking-in to your past-client + referral list.",
      trigger_event: "schedule_recurring",
      trigger_filter: { interval: "every_quarter", segment: "soi" },
      actions: [
        { type: "send_email", template: "quarterly_market_update", delay_minutes: 0 },
        { type: "wait_days", days: 7 },
        { type: "create_task", title: "Make 5 SOI calls this week", due_in_hours: 168 },
      ],
    },
  ],

  // ── 10 SMS templates ──────────────────────────────────────────────────
  sms_templates: [
    {
      name: "Showing Reminder (24h)",
      body: "Hi {{first_name}}, just a reminder of our showing tomorrow at {{address}} at {{time}}. Reply YES to confirm or RESCHEDULE if anything's changed. — {{agent_name}}",
      category: "showing",
      variables: ["first_name", "address", "time", "agent_name"],
    },
    {
      name: "Showing Reminder (2h)",
      body: "Hey {{first_name}} — heading to {{address}} now, see you at {{time}}. Look for the {{car_color}} car out front.",
      category: "showing",
      variables: ["first_name", "address", "time", "car_color"],
    },
    {
      name: "Post-Showing Follow-up",
      body: "Hi {{first_name}}, thanks for letting me show you {{address}} today. What were your top 2 thoughts? Worth a second look or move on?",
      category: "followup",
      variables: ["first_name", "address"],
    },
    {
      name: "Contract Milestone — Inspection Scheduled",
      body: "{{first_name}}, inspection is locked for {{date}} at {{time}}. The inspector ({{inspector_name}}) will text you 30 min ahead. You don't need to be there — I'll be on-site.",
      category: "transaction",
      variables: ["first_name", "date", "time", "inspector_name"],
    },
    {
      name: "Contract Milestone — Appraisal In",
      body: "{{first_name}}, appraisal came back at {{appraisal_value}}. Quick call to walk through next steps? I'm free {{available_window}}.",
      category: "transaction",
      variables: ["first_name", "appraisal_value", "available_window"],
    },
    {
      name: "Closing Day",
      body: "Big day, {{first_name}}! Closing is at {{time}} at {{location}}. Bring your driver's license + cashier's check for {{closing_amount}}. Congrats in advance.",
      category: "transaction",
      variables: ["first_name", "time", "location", "closing_amount"],
    },
    {
      name: "FSBO First Touch",
      body: "Hi {{first_name}}, saw your listing at {{address}} — looks great. I work with buyers in {{neighborhood}} and have 2 actively looking right now. Worth a 5-min chat to see if there's a fit?",
      category: "prospecting",
      variables: ["first_name", "address", "neighborhood"],
    },
    {
      name: "Expired Listing Outreach",
      body: "Hi {{first_name}}, I noticed {{address}} came off the market. I help sellers reposition expireds and get them sold in {{avg_days_on_market}} days on average. Free 10-min strategy call this week?",
      category: "prospecting",
      variables: ["first_name", "address", "avg_days_on_market"],
    },
    {
      name: "Open House RSVP Confirmation",
      body: "Got you on the list for the {{address}} open house on {{date}} at {{time}}. I'll text the entry code 30 min before. Bring questions — happy to talk financing too.",
      category: "showing",
      variables: ["address", "date", "time"],
    },
    {
      name: "New Listing Alert (Saved Search)",
      body: "{{first_name}}, fresh listing matched your search: {{address}} — {{beds}}bd/{{baths}}ba, {{price}}. Worth a look this weekend? Reply YES and I'll set it up.",
      category: "prospecting",
      variables: ["first_name", "address", "beds", "baths", "price"],
    },
  ],

  // ── 5 email templates ─────────────────────────────────────────────────
  email_templates: [
    {
      name: "New Listing Announcement",
      subject: "Just listed: {{address}} — {{headline_feature}}",
      body: "Hi {{first_name}},\n\nThis just hit the market and I wanted you to see it before the open house Saturday:\n\n{{address}} — {{beds}}bd / {{baths}}ba — {{price}}\n\nWhat caught my eye:\n- {{highlight_1}}\n- {{highlight_2}}\n- {{highlight_3}}\n\nFull listing + photos: {{listing_url}}\n\nIf you'd like a private showing before the public open house, I have slots {{availability}}. Just hit reply.\n\n— {{agent_name}}",
      category: "listing",
      variables: ["first_name", "address", "headline_feature", "beds", "baths", "price", "highlight_1", "highlight_2", "highlight_3", "listing_url", "availability", "agent_name"],
    },
    {
      name: "Monthly Market Update",
      subject: "{{neighborhood}} market — {{month}} snapshot",
      body: "Hi {{first_name}},\n\nQuick {{month}} numbers for {{neighborhood}}:\n\n- Median sale price: {{median_price}} ({{price_change}} vs last month)\n- Average days on market: {{avg_dom}}\n- Active listings: {{active_count}} (vs {{prior_active_count}} last month)\n\nWhat this means: {{interpretation}}\n\nThinking about a move in the next 6-12 months? Reply with a single word — SELL, BUY, or BOTH — and I'll send a tailored 1-pager.\n\n— {{agent_name}}",
      category: "nurture",
      variables: ["first_name", "neighborhood", "month", "median_price", "price_change", "avg_dom", "active_count", "prior_active_count", "interpretation", "agent_name"],
    },
    {
      name: "Under Contract — What Happens Next",
      subject: "Under contract on {{address}} — your next 30 days",
      body: "{{first_name}},\n\nCongrats — we're under contract on {{address}}. Here's what the next 30 days looks like, day by day:\n\n- Day 1-5: Inspection. I'll line up the inspector and be on-site for you.\n- Day 5-10: Inspection response + repair negotiations.\n- Day 10-20: Appraisal + lender finalisation.\n- Day 20-28: Final walkthrough.\n- Day 30: Closing.\n\nKey dates I'll need from you: {{key_dates}}\n\nAny questions, hit reply. I'll send each milestone as it lands.\n\n— {{agent_name}}",
      category: "transaction",
      variables: ["first_name", "address", "key_dates", "agent_name"],
    },
    {
      name: "Closing Day Welcome",
      subject: "Welcome home, {{first_name}} 🏡",
      body: "{{first_name}},\n\nKeys are yours. Welcome home.\n\nA few housekeeping items for the first week:\n- Utility transfer confirmation: {{utility_status}}\n- HOA contact (if applicable): {{hoa_contact}}\n- Local handyman recs: {{handyman_recs}}\n- My favourite {{neighborhood}} spots: {{local_recs}}\n\nIf anything pops up in the first 30 days that you'd like a recommendation for — tradespeople, school options, anything — just text me. Most agents disappear after closing. I don't.\n\n— {{agent_name}}",
      category: "post-close",
      variables: ["first_name", "neighborhood", "utility_status", "hoa_contact", "handyman_recs", "local_recs", "agent_name"],
    },
    {
      name: "FSBO Soft Touch (Value-First)",
      subject: "Free comp for {{address}} — no strings",
      body: "Hi {{first_name}},\n\nNoticed you're selling {{address}} on your own. Respect — about 1 in 10 FSBOs close without an agent.\n\nNo pitch. Just sending you a free comp report I pulled this morning so you can sanity-check your asking price against the last 6 closed sales within {{radius}} miles:\n\n{{comp_report_url}}\n\nIf the data is useful and you ever want a 15-min call on positioning, my number is {{phone}}. Otherwise — best of luck with the sale.\n\n— {{agent_name}}",
      category: "prospecting",
      variables: ["first_name", "address", "radius", "comp_report_url", "phone", "agent_name"],
    },
  ],

  // ── 3 cold-call scripts ───────────────────────────────────────────────
  call_scripts: [
    {
      name: "FSBO First Call",
      scenario: "First call to a For-Sale-By-Owner listing within 48h of it appearing.",
      script:
        "Hi, is this {{first_name}}? Hi {{first_name}}, this is {{agent_name}} with {{agency_name}}. I noticed your listing on {{address}} — looks like a great property.\n\nI'm not calling to convince you to list with me. I'm actually calling for one specific reason: I have {{buyer_count}} buyers actively looking in {{neighborhood}} right now, and your home matches what {{matched_buyers}} of them are searching for.\n\nWould it be worth a 5-minute call to see if there's a fit? If there is, you keep your sign in the yard, and I'd just bring the buyer through. Worst case, I waste 5 minutes of your time.\n\n[If yes] Great. Are you free {{availability_a}} or would {{availability_b}} work better?\n[If no, soft close] Totally understand. Mind if I send you a free comp report just so you can sanity-check your price? No strings, no follow-up unless you want one.",
      rationale:
        "Leads with their interest (your buyers), not yours (relisting them). Reduces pressure, opens door to comp-report soft-touch even on a no.",
    },
    {
      name: "Expired Listing Reactivation",
      scenario: "Calling owners whose listing came off the market within the last 14 days.",
      script:
        "Hi, is this {{first_name}}? Hi {{first_name}}, this is {{agent_name}} with {{agency_name}}. Quick reason for the call — I noticed your listing at {{address}} came off the market.\n\nI know that's frustrating. Most expireds come down to one of three things: pricing, photos, or exposure. I'd love to share which of those I think it was — no charge, no obligation.\n\nDo you have 8 minutes today or tomorrow for me to walk you through what I'd do differently? I've reactivated {{expired_success_count}} expired listings in the last {{period}} and the average time-to-contract was {{avg_days}} days.\n\n[If yes] Perfect. {{availability_a}} or {{availability_b}}?\n[If 'I'm taking a break from selling'] Completely fair. Can I drop you a 1-page postmortem on what I think happened? If you decide to relist in 6 weeks or 6 months, you'll have it.",
      rationale:
        "Acknowledges frustration first, names the 3 likely causes (proves expertise without arguing), offers a postmortem even on a soft no.",
    },
    {
      name: "Sphere of Influence (Quarterly Check-in)",
      scenario: "Quarterly call to past clients and personal-network contacts. Goal: stay top-of-mind, surface referrals.",
      script:
        "Hey {{first_name}}, it's {{agent_name}}. Got a sec? Just doing my quarterly check-in calls — no agenda, just want to see how the family / business / new place is going.\n\n[Listen — let them talk. 60-90 seconds minimum.]\n\nOn the real-estate side, two quick things: {{neighborhood}} median is up about {{percent_change}} since you closed, so your equity position is solid. And second — I had {{recent_close_count}} closings last quarter, and {{referral_close_count}} of those came from referrals. So if anyone in your circle is thinking about a move, please throw my name in the ring. I'll always treat them like family.\n\n[Then back to listening — don't rush off. Ask about kids/spouse/job by name if you know them.]",
      rationale:
        "Opens with no agenda — humans first, business second. Drops the equity number as a value beat. Ends with the ask, but only after listening. Keeps you in the referral fabric without becoming the salesy ex who only calls when they need something.",
    },
  ],

  // ── Lead scoring rules (urgency markers) ──────────────────────────────
  scoring_rules: [
    {
      name: "Moving in 30 days",
      signal: "Lead form mentions 'moving in 30 days' or specific move-in deadline within 30 days",
      score_delta: 25,
      dimension: "urgency",
    },
    {
      name: "Pre-approved buyer",
      signal: "Lead has uploaded or referenced a pre-approval letter",
      score_delta: 20,
      dimension: "urgency",
    },
    {
      name: "First-time buyer",
      signal: "Form indicates first-time buyer (typically high intent, needs hand-holding, sticks)",
      score_delta: 10,
      dimension: "intent",
    },
    {
      name: "Cash buyer",
      signal: "Lead mentions cash purchase — fast close, no financing risk",
      score_delta: 25,
      dimension: "fit",
    },
    {
      name: "Saved search 2+ weeks ago",
      signal: "Lead set up a saved search and has clicked at least 3 listings — actively shopping",
      score_delta: 15,
      dimension: "intent",
    },
    {
      name: "Out-of-state relocation",
      signal: "Lead is relocating from another state — urgency typically tied to a job start date",
      score_delta: 15,
      dimension: "urgency",
    },
    {
      name: "Just sold — needs to buy",
      signal: "Lead has already sold their previous home and is in temporary housing",
      score_delta: 30,
      dimension: "urgency",
    },
    {
      name: "Tire-kicker (no timeline)",
      signal: "Lead explicitly says 'just looking' or 'maybe in 1-2 years'",
      score_delta: -15,
      dimension: "urgency",
    },
  ],

  // ── 10-module course: Real Estate Lead-Gen Mastery ────────────────────
  course: {
    title: "Real Estate Lead-Gen Mastery",
    description:
      "A 10-module practitioner course on how modern residential agents fill their pipeline — across FSBO, expireds, SOI, online ads, and content. Every module ends with a 24-hour action assignment, not theory.",
    modules: [
      {
        title: "Module 1 — The Modern Lead Pipeline",
        description: "How a healthy pipeline actually looks: ratios, channels, and the 90-day lead-to-close math.",
        lessons: [
          {
            title: "The 7 channels every agent should run (and the 3 most won't)",
            content_type: "video",
            duration_seconds: 720,
            content_body: "Walkthrough of FSBO, expireds, SOI, paid ads, organic content, open houses, and door-knocking. We rate each on cost, time, and conversion.",
          },
          {
            title: "The lead-to-close math: how many calls = 1 closing",
            content_type: "video",
            duration_seconds: 600,
            content_body: "Industry benchmark ratios. 100 dials → 20 contacts → 5 appointments → 1 listing.",
          },
          {
            title: "Action: pick your 3 channels for the next 90 days",
            content_type: "text",
            duration_seconds: 300,
            content_body: "Worksheet: pick 3 channels you can run weekly, set a target activity count, log it in your CRM.",
          },
        ],
      },
      {
        title: "Module 2 — FSBO Outreach That Doesn't Get You Hung Up On",
        description: "How to call FSBOs and not sound like every other agent on day one.",
        lessons: [
          {
            title: "Why FSBOs hate agent calls (and how to avoid being one)",
            content_type: "video",
            duration_seconds: 480,
            content_body: "The 3 phrases that get you hung up on, and the 1 phrase that keeps them on the call.",
          },
          {
            title: "The buyer-first FSBO opener (with role-play)",
            content_type: "video",
            duration_seconds: 540,
            content_body: "Walkthrough of the buyer-first opener script + 2 role-plays handling common objections.",
          },
          {
            title: "FSBO follow-up cadence: 7 touches over 21 days",
            content_type: "text",
            duration_seconds: 300,
            content_body: "Day 1 call, day 3 mail-piece, day 7 call back, day 14 email comp report, day 21 final ask.",
          },
        ],
      },
      {
        title: "Module 3 — Expired Listings & The Reactivation Play",
        description: "Calling owners after a failed listing — how to turn frustration into a relisting.",
        lessons: [
          {
            title: "The 3 reasons listings expire (price, photos, exposure)",
            content_type: "video",
            duration_seconds: 540,
            content_body: "Diagnosing which of the three killed the listing. Decides which pitch you bring on the call.",
          },
          {
            title: "The expired postmortem PDF (free template)",
            content_type: "text",
            duration_seconds: 240,
            content_body: "1-page postmortem doc you send even on a soft 'no' — keeps you top-of-mind for relisting in 6 weeks.",
          },
        ],
      },
      {
        title: "Module 4 — Sphere of Influence (SOI) Without Being Awkward",
        description: "Quarterly touch system that doesn't feel like begging for referrals.",
        lessons: [
          {
            title: "The quarterly check-in script (no-agenda framework)",
            content_type: "video",
            duration_seconds: 480,
            content_body: "How to call past clients without sounding like you're fishing — and still surface 1-2 referrals per call.",
          },
          {
            title: "Tagging + segmenting your SOI in CRM",
            content_type: "text",
            duration_seconds: 300,
            content_body: "Tag taxonomy: past_client, family, friend, vendor, referral_source. Each gets a different cadence.",
          },
        ],
      },
      {
        title: "Module 5 — Open Houses That Actually Convert",
        description: "Turning Saturday foot traffic into nurture leads, not awkward small talk.",
        lessons: [
          {
            title: "The 3-question intake at the door",
            content_type: "video",
            duration_seconds: 420,
            content_body: "Three questions every visitor answers before walking through. Sets the followup automatically.",
          },
          {
            title: "Pre-, during-, and post-event automations",
            content_type: "text",
            duration_seconds: 360,
            content_body: "RSVP confirmation → 24h reminder → 2h reminder → post-showing followup → 7-day check-in.",
          },
        ],
      },
      {
        title: "Module 6 — Listing Alerts & Saved Searches",
        description: "Keeping buyers warm with the right new listings, not a daily spam blast.",
        lessons: [
          {
            title: "Setting up smart saved searches in MLS",
            content_type: "video",
            duration_seconds: 480,
            content_body: "Filter by price, beds, neighborhood, and 'must-have' features — not just bed count.",
          },
          {
            title: "Cadence: every 3 days vs daily vs weekly (data-backed)",
            content_type: "text",
            duration_seconds: 300,
            content_body: "Open-rate data shows every-3-days beats daily. Why, and when to override.",
          },
        ],
      },
      {
        title: "Module 7 — Paid Ads (Meta + Google) for Real Estate",
        description: "Where to spend $500/mo and where not to.",
        lessons: [
          {
            title: "Lead magnet ads: Free home valuation vs Buyer guide",
            content_type: "video",
            duration_seconds: 600,
            content_body: "Which lead magnet performs better in 2026, and how to A/B test with a $200 budget.",
          },
          {
            title: "Retargeting old leads at 1/3 the CPM",
            content_type: "text",
            duration_seconds: 300,
            content_body: "Building a retargeting audience from CRM contacts. Why it's the best ROI an agent can run.",
          },
        ],
      },
      {
        title: "Module 8 — Content & Local Authority",
        description: "Becoming the agent buyers Google for — without becoming a full-time content creator.",
        lessons: [
          {
            title: "The 1-video-a-week neighborhood spotlight system",
            content_type: "video",
            duration_seconds: 540,
            content_body: "30-minute Saturday shoot, 4 videos a month, evergreen for years.",
          },
          {
            title: "Hyper-local SEO: ranking for '<neighborhood> real estate agent'",
            content_type: "text",
            duration_seconds: 360,
            content_body: "Schema markup, GBP optimization, neighborhood-level content briefs.",
          },
        ],
      },
      {
        title: "Module 9 — Buyer Consultation: Closing the Buyer Rep Agreement",
        description: "Walking a buyer from 'I'm just looking' to a signed buyer-rep agreement.",
        lessons: [
          {
            title: "The 5-question buyer consultation flow",
            content_type: "video",
            duration_seconds: 540,
            content_body: "Five questions that shift a buyer from passive to committed in a 30-minute consultation.",
          },
          {
            title: "Handling the 'why should I sign exclusive?' objection",
            content_type: "text",
            duration_seconds: 300,
            content_body: "Three responses that work, ranked by directness.",
          },
        ],
      },
      {
        title: "Module 10 — Listing Presentation & Pricing the Listing",
        description: "Winning the listing meeting and pricing without leaving money on the table.",
        lessons: [
          {
            title: "The pre-listing package (sent before the meeting)",
            content_type: "video",
            duration_seconds: 480,
            content_body: "What to send 24-48h before the listing meeting so you walk in already won.",
          },
          {
            title: "Pricing strategy: list-to-sell ratio targets by market",
            content_type: "text",
            duration_seconds: 360,
            content_body: "How to back into a list price using the last 6 comps + a 2% pricing band.",
          },
        ],
      },
    ],
  },

  // ── 5-step funnel: FSBO → opt-in → qualifier → call → contract ────────
  funnel: {
    name: "FSBO to Listing Funnel",
    description:
      "Captures FSBO sellers via a free comp-report opt-in, qualifies them with a short form, books a 15-min call, and routes signed listing agreements to the agent's pipeline.",
    steps: [
      {
        title: "FSBO Comp Report Opt-in",
        step_type: "opt-in",
        description: "Landing page offering a free comparable-sales report for the seller's address.",
      },
      {
        title: "Qualifier — 4-question form",
        step_type: "qualifier",
        description: "Timeline, motivation, prior agent experience, and listing-readiness score.",
      },
      {
        title: "Book a 15-minute call",
        step_type: "call",
        description: "Calendar embed for the seller to pick a time. Auto-routes to the agent's calendar.",
      },
      {
        title: "Listing Presentation",
        step_type: "checkout",
        description: "Tracks pre-listing package send → meeting attendance → listing agreement signed.",
      },
      {
        title: "Listing Agreement Signed",
        step_type: "thank-you",
        description: "Onboarding email + post-signing checklist (photos, lockbox, MLS draft) auto-fires.",
      },
    ],
  },
};
