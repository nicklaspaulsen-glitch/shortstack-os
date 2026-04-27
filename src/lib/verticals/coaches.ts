/**
 * Coaches & Consultants vertical template.
 *
 * Pre-configured for solo coaches (life, business, executive, fitness)
 * and small consulting practices that sell discovery calls + multi-month
 * engagements. Funnel is webinar/discovery-call-led; nurture is
 * accountability-driven.
 */

import type { VerticalTemplate } from "./types";

export const COACHES_TEMPLATE: VerticalTemplate = {
  vertical: "coaches",
  display_name: "Coaches & Consultants",
  tagline: "Discovery calls, accountability sequences, milestone nurture.",
  description:
    "Pre-configured ShortStack OS bundle for coaches and consultants. Includes 5 lead-gen automations (discovery calls, email courses, webinars), 10 SMS templates for session reminders and accountability check-ins, 5 email templates for welcome, milestones, and renewal, 3 phone scripts (referral followup, past-client re-engagement, qualifying calls), engagement-based lead scoring, an 8-module Coaching Business Foundations course, and a webinar→enrollment funnel.",
  accent: "purple",
  icon: "GraduationCap",

  // ── 5 lead-gen automations ────────────────────────────────────────────
  automations: [
    {
      name: "Free Discovery Call Booking",
      description: "Triggered when a prospect books a discovery call. Confirms, sends prep questions, reminders.",
      trigger_event: "calendar_booking",
      trigger_filter: { event_type: "discovery_call" },
      actions: [
        { type: "send_email", template: "discovery_call_confirmation", delay_minutes: 0 },
        { type: "wait_hours", hours: 24 },
        { type: "send_email", template: "discovery_call_prep_questions", delay_minutes: 0 },
        { type: "wait_hours", hours: 22 },
        { type: "send_sms", template: "discovery_call_reminder_2h", delay_minutes: 0 },
      ],
    },
    {
      name: "Email Course Opt-in (5-day mini-course)",
      description: "Drips a 5-day email course to opt-ins, then transitions to a discovery-call CTA.",
      trigger_event: "form_submit",
      trigger_filter: { form_type: "email_course_optin" },
      actions: [
        { type: "send_email", template: "email_course_day_1", delay_minutes: 0 },
        { type: "wait_days", days: 1 },
        { type: "send_email", template: "email_course_day_2", delay_minutes: 0 },
        { type: "wait_days", days: 1 },
        { type: "send_email", template: "email_course_day_3", delay_minutes: 0 },
        { type: "wait_days", days: 1 },
        { type: "send_email", template: "email_course_day_4", delay_minutes: 0 },
        { type: "wait_days", days: 1 },
        { type: "send_email", template: "email_course_day_5_with_cta", delay_minutes: 0 },
      ],
    },
    {
      name: "Webinar Registration → Attendance → Replay",
      description: "Confirmation, day-of and 30-min reminders, replay link to no-shows, post-webinar pitch.",
      trigger_event: "webinar_registration",
      actions: [
        { type: "send_email", template: "webinar_confirmation", delay_minutes: 0 },
        { type: "send_email", template: "webinar_day_of_reminder", delay_minutes: 0, schedule: "day_of_event_8am" },
        { type: "send_sms", template: "webinar_30min_reminder", delay_minutes: 0, schedule: "30_min_before" },
        { type: "wait_hours", hours: 4, after: "event_end" },
        { type: "send_email", template: "webinar_replay_or_thanks", delay_minutes: 0 },
        { type: "wait_days", days: 2 },
        { type: "send_email", template: "post_webinar_pitch", delay_minutes: 0 },
      ],
    },
    {
      name: "Accountability Check-in (Active Clients)",
      description: "Weekly Monday check-in for active coaching clients. Surfaces drop-offs early.",
      trigger_event: "schedule_recurring",
      trigger_filter: { interval: "every_monday_8am", segment: "active_client" },
      actions: [
        { type: "send_sms", template: "monday_accountability_checkin", delay_minutes: 0 },
        { type: "wait_hours", hours: 8 },
        { type: "send_email", template: "weekly_progress_log", delay_minutes: 0, condition: "no_sms_reply" },
        { type: "create_task", title: "Manual followup with client", due_in_hours: 48, condition: "no_email_open" },
      ],
    },
    {
      name: "Renewal / Re-engagement (90 days from finish)",
      description: "90 days after a client wraps, re-engages with a check-in + renewal offer.",
      trigger_event: "client_program_completed_plus_90d",
      actions: [
        { type: "send_email", template: "90_day_alumni_checkin", delay_minutes: 0 },
        { type: "wait_days", days: 5 },
        { type: "send_email", template: "renewal_offer_alumni", delay_minutes: 0, condition: "email_opened" },
        { type: "wait_days", days: 7 },
        { type: "send_sms", template: "alumni_personal_followup", delay_minutes: 0, condition: "no_response" },
      ],
    },
  ],

  // ── 10 SMS templates ──────────────────────────────────────────────────
  sms_templates: [
    {
      name: "Session Reminder (24h)",
      body: "Hey {{first_name}}, looking forward to our session tomorrow at {{time}}. Anything specific you want to dig into? Send me one line — helps me prep.",
      category: "session",
      variables: ["first_name", "time"],
    },
    {
      name: "Session Reminder (2h)",
      body: "{{first_name}} — our session is in 2 hours at {{time}}. Zoom link: {{zoom_url}}. See you then.",
      category: "session",
      variables: ["first_name", "time", "zoom_url"],
    },
    {
      name: "Discovery Call Reminder",
      body: "Hi {{first_name}} — quick reminder about our discovery call at {{time}}. It's a no-pressure chat to see if there's a fit. Zoom: {{zoom_url}}",
      category: "discovery",
      variables: ["first_name", "time", "zoom_url"],
    },
    {
      name: "Monday Accountability Check-in",
      body: "Morning {{first_name}}. Quick Monday check-in: what's the ONE thing on your list this week that, if it gets done, makes the week a win? Reply when you have a sec.",
      category: "accountability",
      variables: ["first_name"],
    },
    {
      name: "Mid-Week Nudge",
      body: "Hey {{first_name}} — halfway through the week. How's that #1 thing going? If you're stuck, hit reply. Quick voice memo from me if helpful.",
      category: "accountability",
      variables: ["first_name"],
    },
    {
      name: "Friday Win Capture",
      body: "{{first_name}}, end-of-week ritual: drop me one win from this week, however small. Going to celebrate them as a group on Sunday.",
      category: "accountability",
      variables: ["first_name"],
    },
    {
      name: "Milestone — 30 Days In",
      body: "30 days. Look at where you were when we started: {{baseline}}. Look at now: {{current_state}}. Proud of you, {{first_name}}.",
      category: "milestone",
      variables: ["first_name", "baseline", "current_state"],
    },
    {
      name: "Missed Session Reschedule",
      body: "Hey {{first_name}}, didn't see you on the line at {{time}}. Life happens. Want to reschedule? Pick a slot here: {{calendar_url}}",
      category: "session",
      variables: ["first_name", "time", "calendar_url"],
    },
    {
      name: "Alumni 90-Day Check-in",
      body: "{{first_name}}, hit me with one update — what's one thing from our work together that's still showing up in your life 90 days later? Curious.",
      category: "renewal",
      variables: ["first_name"],
    },
    {
      name: "Webinar 30-Min Reminder",
      body: "{{first_name}} — {{webinar_topic}} starts in 30. Doors open in 25. Link: {{webinar_url}} — see you in there.",
      category: "webinar",
      variables: ["first_name", "webinar_topic", "webinar_url"],
    },
  ],

  // ── 5 email templates ─────────────────────────────────────────────────
  email_templates: [
    {
      name: "Welcome (Day 1 of Engagement)",
      subject: "Welcome aboard, {{first_name}} — here's what week 1 looks like",
      body: "Hi {{first_name}},\n\nWelcome. Excited to start working together.\n\nHere's what week 1 looks like:\n\n- Day 1 (today): Read this email + complete the intake form: {{intake_form_url}}\n- Day 2: I'll review your intake and send a tailored kickoff doc.\n- Day 3-4: First session — {{first_session_focus}}.\n- Day 5: Your first homework lands.\n\nRules of engagement:\n1. Voice memos beat emails. Send anything that feels too long to type.\n2. If something is on fire, text me. Don't wait for our session.\n3. Your wins are my wins. Celebrate them with me.\n\nCan't wait to dig in.\n\n— {{coach_name}}",
      category: "onboarding",
      variables: ["first_name", "intake_form_url", "first_session_focus", "coach_name"],
    },
    {
      name: "Milestone — First 30 Days",
      subject: "30 days. Here's what changed.",
      body: "{{first_name}},\n\nWe're 30 days in. Stepping back for a sec.\n\nWhen we started, you said: \"{{starting_quote}}.\"\n\nThis week, you said: \"{{recent_quote}}.\"\n\nThat's not nothing. That's a real shift, and you did the work — I just held the mirror.\n\nWhat I'd like us to do this week is name the next 30-day milestone. Specific, measurable, real. Bring 2-3 candidates to our Thursday session and we'll pick.\n\nProud of you.\n\n— {{coach_name}}",
      category: "milestone",
      variables: ["first_name", "starting_quote", "recent_quote", "coach_name"],
    },
    {
      name: "Mid-Engagement Renewal Conversation",
      subject: "{{first_name}} — let's talk what's next",
      body: "Hi {{first_name}},\n\nWe're {{weeks_in}} weeks in, and our current engagement wraps in {{weeks_remaining}} weeks.\n\nI like to start the 'what's next' conversation early — not because I'm trying to upsell, but because the worst version of this is you finishing strong and then dropping off a cliff because there's no plan.\n\nThree options I see:\n\n1. **Wrap and graduate.** You're in flow, you have your systems, you don't need me. Totally legitimate — and the highest compliment to the work.\n2. **Quarterly retainer.** One session a month, a slack channel, you pull me in when you need me. Lighter touch.\n3. **Continue at current cadence.** Same intensity, new 90-day arc focused on {{next_arc_focus}}.\n\nWhich resonates? No wrong answer. Reply with 1, 2, or 3 (or 'let's talk').\n\n— {{coach_name}}",
      category: "renewal",
      variables: ["first_name", "weeks_in", "weeks_remaining", "next_arc_focus", "coach_name"],
    },
    {
      name: "Webinar Replay + Pitch",
      subject: "Replay inside — and the offer I made on the call",
      body: "Hi {{first_name}},\n\nIf you missed the webinar live (or want to re-watch the part you took notes on), here's the replay: {{replay_url}}\n\nThe offer I made at the end:\n\n{{offer_summary}}\n\nIt's open until {{deadline}}, then it's gone. Not a fake-scarcity thing — I only take {{cohort_size}} in this round, and I want to start with the people who decide quickly.\n\nIf you have questions, just reply. If you're ready to go: {{enrollment_url}}\n\n— {{coach_name}}",
      category: "webinar",
      variables: ["first_name", "replay_url", "offer_summary", "deadline", "cohort_size", "enrollment_url", "coach_name"],
    },
    {
      name: "Alumni 90-Day Re-engagement",
      subject: "{{first_name}}, one quick question",
      body: "Hey {{first_name}},\n\nIt's been about 90 days since we wrapped. I do a check-in with every alumni — partly because I genuinely want to know how it's holding up, partly because I want to learn what stuck and what didn't.\n\nOne question: of everything we worked on, what's one thing you're still actively using?\n\nReply with even one sentence and I'll send you the quarterly alumni resource pack: {{alumni_resource_summary}}.\n\n— {{coach_name}}",
      category: "renewal",
      variables: ["first_name", "alumni_resource_summary", "coach_name"],
    },
  ],

  // ── 3 phone scripts ───────────────────────────────────────────────────
  call_scripts: [
    {
      name: "Referral Follow-up Call",
      scenario: "Calling a warm referral introduced by a past client.",
      script:
        "Hi {{first_name}}, this is {{coach_name}}. {{referrer_name}} mentioned you might be working through {{topic}} and thought we should chat. Got a few minutes?\n\n[If yes] Great. Quick context on me: I work with {{ideal_client_type}} on {{focus_area}}. {{Referrer_name}} and I worked together for {{duration}} on {{their_outcome}}.\n\nBefore I tell you anything more about what I do, I'd rather hear what's going on for you. What made {{referrer_name}}'s name come up when you were thinking about this?\n\n[Listen — 60-90 seconds at minimum.]\n\nWhat I'm hearing is {{paraphrase}}. Two questions: how long has this been the case, and what have you tried already?\n\n[After their answers]\n\nHere's what I'd do if I were you: {{first_thought}}. If we end up working together, that's where we'd start. If not, run with that anyway — {{referrer_name}} got the same advice on a free call once.\n\nIf this resonated and you want to keep talking, I have a longer discovery call slot {{availability}}. No pressure. Want me to send the link?",
      rationale:
        "Referral calls work best when you don't pitch in the first 5 minutes. Lead with curiosity, give value before asking, and let the prospect ask 'so how does this work?' on their own terms.",
    },
    {
      name: "Past-Client Re-engagement",
      scenario: "Calling a past client 90+ days post-engagement to check in and surface a renewal opportunity.",
      script:
        "Hey {{first_name}} — {{coach_name}}. Got 5 minutes? Just doing my quarterly alumni check-ins.\n\n[If yes]\n\nNo pitch, promise. I just want to know how things are landing 90 days out. What's still showing up from our work?\n\n[Listen.]\n\nWhat's on your plate now that we didn't get to in our engagement?\n\n[Listen. This is the gold.]\n\nOK — totally hear that. Two thoughts:\n\n1. Some of that I might be able to help with in a 1-2 session 'tune-up' — short, focused, not a full re-engagement. Want me to send a slot?\n2. If it's bigger than that, I'm running a 6-week intensive on {{relevant_program}} starting {{start_date}}. {{cohort_size}} people, no more. Want me to send details?\n\nNo pressure either way. Mostly wanted to hear how you're doing.",
      rationale:
        "Past clients are the highest-conversion segment for any coach. The script gives them a low-friction option (1-session tune-up) AND a bigger commitment (intensive) — they pick what fits.",
    },
    {
      name: "Qualifying Call (Discovery Call Variant)",
      scenario: "First call with a stranger who booked a discovery slot. Goal: qualify fit, then either book a strategy session or politely route to free resources.",
      script:
        "Hi {{first_name}}, thanks for booking. Quick framing: this call is 30 minutes. First 20, you talk and I ask questions. Last 10, I tell you whether I think we're a fit and what I'd recommend either way.\n\nSound good?\n\n[Yes]\n\nGreat. Question 1: in your own words, what made you book this call now?\n\n[Listen. Don't fill silence.]\n\nQuestion 2: what have you tried already, and what got in the way?\n\n[Listen.]\n\nQuestion 3: if we worked together for {{program_length}} and only solved one thing, what would make this worth it?\n\n[Listen.]\n\nQuestion 4: walk me through what your week actually looks like right now. Specifically the {{relevant_routine}}.\n\n[Listen.]\n\nQuestion 5: budget for solving this? I'm not asking for a number, I'm asking — is this an 'I'll spend whatever it takes' priority or a 'maybe in 6 months' priority?\n\n[Listen.]\n\nOK — based on what you've said, here's my read: {{honest_assessment}}.\n\n[If fit] I'd recommend the {{recommended_program}}. Three options: pay-in-full, monthly, or a 30-min paid strategy session first if you want to test the working dynamic. Want me to send the details + a slot to dig in further?\n\n[If not fit] Honestly, I don't think I'm the right call for you right now. Here's what I'd do instead: {{free_resource_or_other_referral}}. Hit me up in 6 months if things change.",
      rationale:
        "The 5-question structure forces you to actually listen instead of pitching. The honest 'not fit' close protects your reputation and creates 'I called and they were the only one honest enough to turn me down' word-of-mouth.",
    },
  ],

  // ── Lead scoring rules (engagement signals) ───────────────────────────
  scoring_rules: [
    {
      name: "Downloaded ebook",
      signal: "Lead opted in for a lead magnet (ebook, guide, template)",
      score_delta: 8,
      dimension: "intent",
    },
    {
      name: "Watched webinar (>50% of runtime)",
      signal: "Lead attended webinar and watched majority of the content",
      score_delta: 18,
      dimension: "intent",
    },
    {
      name: "Watched webinar replay",
      signal: "Lead clicked replay link and watched at least 25% of the replay",
      score_delta: 12,
      dimension: "intent",
    },
    {
      name: "Booked discovery call",
      signal: "Lead booked a slot on the discovery-call calendar",
      score_delta: 25,
      dimension: "urgency",
    },
    {
      name: "Replied to 3+ emails",
      signal: "Lead has replied to at least 3 emails in your sequence",
      score_delta: 15,
      dimension: "intent",
    },
    {
      name: "Past client (alumni)",
      signal: "Lead has previously been a paid client",
      score_delta: 30,
      dimension: "fit",
    },
    {
      name: "Referred by past client",
      signal: "Lead came in via a tagged referral from a past client",
      score_delta: 25,
      dimension: "fit",
    },
    {
      name: "Cold opt-in, no engagement after 30d",
      signal: "Email opt-in with zero opens, clicks, or replies after 30 days",
      score_delta: -15,
      dimension: "intent",
    },
  ],

  // ── 8-module course: Coaching Business Foundations ────────────────────
  course: {
    title: "Coaching Business Foundations",
    description:
      "An 8-module practitioner course on how to build a coaching practice that fills itself — without burning out on social media or undercharging. Every module ends with a 24-hour action assignment.",
    modules: [
      {
        title: "Module 1 — Niche, Promise, Price",
        description: "The 3 decisions every coach must make before they spend a dollar on marketing.",
        lessons: [
          {
            title: "Why generalist coaches stay broke",
            content_type: "video",
            duration_seconds: 540,
            content_body: "The economics of niche vs general — and why specificity is what gets referrals, not what limits them.",
          },
          {
            title: "Writing your one-sentence promise",
            content_type: "video",
            duration_seconds: 480,
            content_body: "The 'I help [who] [outcome] in [timeframe] without [common pain]' framework.",
          },
          {
            title: "Pricing: hourly vs package vs retainer (with examples)",
            content_type: "text",
            duration_seconds: 360,
            content_body: "Three pricing models, when each makes sense, and the math of moving from hourly to package.",
          },
        ],
      },
      {
        title: "Module 2 — The Discovery Call System",
        description: "Turning strangers into qualified strategy-session bookings.",
        lessons: [
          {
            title: "The 5-question discovery call structure",
            content_type: "video",
            duration_seconds: 600,
            content_body: "Five questions that qualify fit in 20 minutes, leaving 10 for an honest recommendation.",
          },
          {
            title: "Handling 'I need to think about it'",
            content_type: "video",
            duration_seconds: 360,
            content_body: "Three responses, ranked by directness. When to push and when to walk.",
          },
          {
            title: "Calendar hygiene: how many calls = burnout",
            content_type: "text",
            duration_seconds: 240,
            content_body: "Sustainable cadence math + how to batch calls so you don't context-switch yourself broke.",
          },
        ],
      },
      {
        title: "Module 3 — Lead Magnets That Actually Convert",
        description: "Stop building 80-page ebooks no one reads.",
        lessons: [
          {
            title: "The 3 lead-magnet archetypes (assessment, template, mini-course)",
            content_type: "video",
            duration_seconds: 540,
            content_body: "Walkthrough of 9 high-converting lead magnets and what makes them work.",
          },
          {
            title: "Building a 5-day email mini-course in a weekend",
            content_type: "text",
            duration_seconds: 480,
            content_body: "Structure, daily lesson template, and the day-5 CTA architecture.",
          },
        ],
      },
      {
        title: "Module 4 — Webinars & Live Workshops",
        description: "Running webinars without sounding like a 2010 internet marketer.",
        lessons: [
          {
            title: "The non-cringe webinar structure",
            content_type: "video",
            duration_seconds: 600,
            content_body: "Hook → teach → demo → offer. Why most coaches kill the offer by overcooking the teach section.",
          },
          {
            title: "Reminder cadence: confirmation → day-of → 30-min",
            content_type: "text",
            duration_seconds: 300,
            content_body: "Show-up rates by reminder type. How to lift attendance from 30% to 50%.",
          },
        ],
      },
      {
        title: "Module 5 — Content & Authority",
        description: "Becoming the coach prospects pre-decide on before the discovery call.",
        lessons: [
          {
            title: "The 1-essay-a-week system (no video required)",
            content_type: "video",
            duration_seconds: 540,
            content_body: "How to write one anchor essay a week and slice it into 10 social posts.",
          },
          {
            title: "Repurposing: 1 essay → 1 video → 5 posts → 1 podcast",
            content_type: "text",
            duration_seconds: 300,
            content_body: "The repurposing pipeline that makes one piece of writing do six jobs.",
          },
        ],
      },
      {
        title: "Module 6 — Onboarding & Client Experience",
        description: "First 30 days of an engagement set the renewal rate. Get them right.",
        lessons: [
          {
            title: "The week-1 welcome sequence",
            content_type: "video",
            duration_seconds: 480,
            content_body: "Email 1 (rules of engagement), email 2 (intake), email 3 (kickoff doc) — what each does.",
          },
          {
            title: "Accountability check-in cadence",
            content_type: "text",
            duration_seconds: 300,
            content_body: "Monday nudge, Wednesday check-in, Friday win capture. Why three lightweight touches beat one heavy one.",
          },
        ],
      },
      {
        title: "Module 7 — Renewals, Referrals, and Retention",
        description: "Your existing clients are your best lead source. Stop ignoring them.",
        lessons: [
          {
            title: "The mid-engagement renewal conversation",
            content_type: "video",
            duration_seconds: 540,
            content_body: "When to bring it up, the three options to offer, and how to make 'graduate' the equally good outcome.",
          },
          {
            title: "Asking for referrals without being weird",
            content_type: "text",
            duration_seconds: 240,
            content_body: "Three referral-ask scripts, when to use each, and the tags + automation to make it not awkward.",
          },
        ],
      },
      {
        title: "Module 8 — Pricing & Packaging",
        description: "Moving from hourly to packages to retainer — and the price-raising playbook.",
        lessons: [
          {
            title: "The price-raise letter template",
            content_type: "video",
            duration_seconds: 480,
            content_body: "How to raise prices on existing clients without losing them. Letter template included.",
          },
          {
            title: "Premium tier creation (and why you need one)",
            content_type: "text",
            duration_seconds: 300,
            content_body: "Why a premium tier you don't sell still increases conversions on your standard tier.",
          },
        ],
      },
    ],
  },

  // ── 5-step funnel: free webinar → discovery → strategy → enrollment → onboarding
  funnel: {
    name: "Webinar to Coaching Enrollment",
    description:
      "Captures registrations for a free webinar, attempts to convert attendees on a discovery-call CTA at the end, qualifies via discovery call, presents a paid strategy session (or full enrollment), and handoffs accepted enrollments into the onboarding sequence.",
    steps: [
      {
        title: "Free Webinar Registration",
        step_type: "opt-in",
        description: "Landing page for a free 60-min webinar. Captures email + first name + 1 qualifying question.",
      },
      {
        title: "Discovery Call Booking",
        step_type: "qualifier",
        description: "Calendar slot booking for a free 30-min discovery call. Pre-call form captures context.",
      },
      {
        title: "Strategy Session (Paid or Free Discovery)",
        step_type: "call",
        description: "The actual call. Coach runs the 5-question structure, then makes a recommendation.",
      },
      {
        title: "Enrollment / Sales Page",
        step_type: "checkout",
        description: "Sales page for the recommended program. Stripe checkout + payment plan options.",
      },
      {
        title: "Onboarding (Week 1 Welcome)",
        step_type: "thank-you",
        description: "Triggers the welcome sequence: rules of engagement → intake form → kickoff doc.",
      },
    ],
  },
};
