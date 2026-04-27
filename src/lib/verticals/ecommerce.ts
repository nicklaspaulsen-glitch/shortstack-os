/**
 * E-commerce vertical template.
 *
 * Pre-configured for DTC brands and Shopify-style stores. Heavy on
 * lifecycle automation — welcome series, cart abandonment, post-purchase
 * upsell, win-back, VIP loyalty. Lead-scoring is intent-based (browsing,
 * cart, viewed-3+-times) rather than urgency-based like real estate.
 */

import type { VerticalTemplate } from "./types";

export const ECOMMERCE_TEMPLATE: VerticalTemplate = {
  vertical: "ecommerce",
  display_name: "E-commerce Brands",
  tagline: "Welcome series, cart abandon, post-purchase, win-back, VIP loyalty.",
  description:
    "Pre-configured ShortStack OS bundle for DTC e-commerce brands. Includes 5 lifecycle automations (welcome, cart abandon, post-purchase upsell, win-back, VIP loyalty), 10 SMS templates for order updates and flash sales, 5 email templates spanning the full lifecycle, 3 phone scripts (CS escalation, retention, B2B wholesale), purchase-intent lead scoring, a 10-module DTC Brand Growth Playbook course, and a paid-traffic-to-repeat-purchase funnel.",
  accent: "sunset",
  icon: "ShoppingBag",

  // ── 5 lifecycle automations ───────────────────────────────────────────
  automations: [
    {
      name: "Welcome Series (3-email new-subscriber)",
      description: "Brand intro, social proof, and first-purchase incentive over 7 days.",
      trigger_event: "newsletter_subscription",
      actions: [
        { type: "send_email", template: "welcome_brand_intro", delay_minutes: 0 },
        { type: "wait_days", days: 2 },
        { type: "send_email", template: "welcome_social_proof", delay_minutes: 0 },
        { type: "wait_days", days: 4 },
        { type: "send_email", template: "welcome_first_order_incentive", delay_minutes: 0 },
        { type: "tag_lead", tag: "subscriber-active" },
      ],
    },
    {
      name: "Cart Abandonment Recovery",
      description: "Three-touch recovery sequence: 1h soft, 24h discount, 72h last-chance.",
      trigger_event: "cart_abandoned",
      actions: [
        { type: "wait_hours", hours: 1 },
        { type: "send_email", template: "cart_abandon_soft", delay_minutes: 0 },
        { type: "wait_hours", hours: 23 },
        { type: "send_email", template: "cart_abandon_discount_10", delay_minutes: 0, condition: "cart_still_active" },
        { type: "wait_days", days: 2 },
        { type: "send_sms", template: "cart_abandon_last_chance", delay_minutes: 0, condition: "cart_still_active" },
      ],
    },
    {
      name: "Post-Purchase Upsell + Review Request",
      description: "Order confirm, ship update, delivery check-in, upsell on day 7, review ask on day 14.",
      trigger_event: "order_placed",
      actions: [
        { type: "send_email", template: "order_confirmation_with_thanks", delay_minutes: 0 },
        { type: "send_sms", template: "order_confirmed_sms", delay_minutes: 5 },
        { type: "wait_days", days: 7 },
        { type: "send_email", template: "post_purchase_upsell", delay_minutes: 0 },
        { type: "wait_days", days: 7 },
        { type: "send_email", template: "review_request", delay_minutes: 0 },
        { type: "tag_lead", tag: "customer-active" },
      ],
    },
    {
      name: "Win-Back (Lapsed 90 days)",
      description: "Re-engages customers who haven't bought in 90 days with a tiered offer.",
      trigger_event: "schedule_recurring",
      trigger_filter: { interval: "daily", segment: "customer_lapsed_90d" },
      actions: [
        { type: "send_email", template: "winback_we_miss_you", delay_minutes: 0 },
        { type: "wait_days", days: 5 },
        { type: "send_email", template: "winback_15_off", delay_minutes: 0, condition: "no_purchase_yet" },
        { type: "wait_days", days: 7 },
        { type: "send_sms", template: "winback_final_25_off", delay_minutes: 0, condition: "no_purchase_yet" },
        { type: "tag_lead", tag: "winback-attempted", condition: "after_all" },
      ],
    },
    {
      name: "VIP Loyalty (LTV > $500)",
      description: "Once a customer crosses an LTV threshold, auto-tags as VIP and unlocks early-access drops.",
      trigger_event: "customer_ltv_threshold",
      trigger_filter: { threshold_usd: 500 },
      actions: [
        { type: "tag_lead", tag: "vip" },
        { type: "send_email", template: "vip_welcome", delay_minutes: 0 },
        { type: "add_to_segment", segment: "early_access_drops" },
        { type: "create_internal_task", title: "Hand-write thank-you note for new VIP", due_in_hours: 72 },
      ],
    },
  ],

  // ── 10 SMS templates ──────────────────────────────────────────────────
  sms_templates: [
    {
      name: "Order Confirmation",
      body: "Order confirmed, {{first_name}}! 📦 You'll get tracking once it ships (usually 1-2 days). Order #{{order_number}}, total {{total}}. Reply HELP if anything looks off.",
      category: "order",
      variables: ["first_name", "order_number", "total"],
    },
    {
      name: "Shipping Update",
      body: "{{first_name}} — your {{brand_name}} order shipped! 🚀 Tracking: {{tracking_url}}. Estimated delivery: {{eta}}.",
      category: "order",
      variables: ["first_name", "brand_name", "tracking_url", "eta"],
    },
    {
      name: "Delivery Confirmation",
      body: "{{first_name}}, your order should be at your door. Did it arrive safe? Reply YES or HELP — we read every reply.",
      category: "order",
      variables: ["first_name"],
    },
    {
      name: "Restock Alert",
      body: "{{product_name}} is back in stock 🎉 You signed up for the alert — first dibs for the next 24h: {{product_url}}",
      category: "marketing",
      variables: ["product_name", "product_url"],
    },
    {
      name: "Flash Sale (24h)",
      body: "Flash 24h sale: {{discount_percent}}% off {{collection_name}} with code {{code}}. Ends tomorrow at midnight. Shop: {{shop_url}}",
      category: "marketing",
      variables: ["discount_percent", "collection_name", "code", "shop_url"],
    },
    {
      name: "Cart Abandonment Last-Chance",
      body: "Hey {{first_name}}, you left {{cart_items_count}} items in your cart. Last call — 10% off with code SAVE10 if you grab them today: {{cart_url}}",
      category: "cart",
      variables: ["first_name", "cart_items_count", "cart_url"],
    },
    {
      name: "Birthday Treat",
      body: "Happy birthday, {{first_name}} 🎂 Use BDAY{{discount_percent}} for {{discount_percent}}% off anything, on us. Valid all month: {{shop_url}}",
      category: "loyalty",
      variables: ["first_name", "discount_percent", "shop_url"],
    },
    {
      name: "VIP Early Access",
      body: "VIP heads-up, {{first_name}}: new drop goes live for VIPs in 6 hours, public in 24. {{drop_name}} — preview: {{preview_url}}",
      category: "loyalty",
      variables: ["first_name", "drop_name", "preview_url"],
    },
    {
      name: "Win-Back 25% Off",
      body: "{{first_name}}, it's been a minute. 25% off your next order with code COMEBACK25 — biggest discount we'll send all year. {{shop_url}}",
      category: "winback",
      variables: ["first_name", "shop_url"],
    },
    {
      name: "Review Request",
      body: "{{first_name}} — how are you liking your {{product_name}}? Drop a review (even 1 line is gold) and we'll send 10% off your next order: {{review_url}}",
      category: "review",
      variables: ["first_name", "product_name", "review_url"],
    },
  ],

  // ── 5 lifecycle email templates ───────────────────────────────────────
  email_templates: [
    {
      name: "Welcome Email (Day 1)",
      subject: "Welcome to {{brand_name}} — here's what makes us different",
      body: "Hi {{first_name}},\n\nWelcome aboard. Quick note from {{founder_name}}, the {{founder_role}}:\n\n{{brand_origin_story_short}}\n\nA few things you should know:\n\n1. **Free shipping over {{free_ship_threshold}}.** No tricks.\n2. **30-day no-questions returns.** If it's not right, send it back.\n3. **First-order welcome:** {{discount_percent}}% off with code {{code}}, valid for 14 days.\n\nThe most-loved item this month is {{top_product}} — {{top_product_why}}.\n\nIf you have questions, hit reply. A real person on our team reads every email.\n\n— {{founder_name}} & the {{brand_name}} crew",
      category: "welcome",
      variables: ["first_name", "brand_name", "founder_name", "founder_role", "brand_origin_story_short", "free_ship_threshold", "discount_percent", "code", "top_product", "top_product_why"],
    },
    {
      name: "Cart Abandonment (Soft, 1h)",
      subject: "{{first_name}}, you left something behind",
      body: "Hey {{first_name}},\n\nLooks like you didn't quite finish your order. No pressure — sometimes life pulls you away. Here's what was in your cart:\n\n{{cart_summary}}\n\nIf there was something we can answer (sizing, materials, ship time?), just hit reply.\n\nReady to wrap it up? {{cart_url}}\n\n— {{brand_name}}",
      category: "cart",
      variables: ["first_name", "cart_summary", "cart_url", "brand_name"],
    },
    {
      name: "Post-Purchase Upsell (Day 7)",
      subject: "Pairs perfectly with your {{purchased_item}}",
      body: "Hi {{first_name}},\n\nHope you're loving your {{purchased_item}}. A few customers have asked us 'what pairs well with this?' so we put together a quick list:\n\n{{recommended_items_block}}\n\nFor friends-of-the-brand: 15% off any of these with code FRIENDS15, valid 7 days. {{shop_url}}\n\nNot in the mood to shop more? Totally fair — feel free to ignore. We'll be here when you need us.\n\n— {{brand_name}}",
      category: "post-purchase",
      variables: ["first_name", "purchased_item", "recommended_items_block", "shop_url", "brand_name"],
    },
    {
      name: "VIP Loyalty Welcome",
      subject: "{{first_name}}, you're officially a {{brand_name}} VIP 💎",
      body: "{{first_name}},\n\nYou crossed our VIP threshold this week. That means you've been with us through {{order_count}} orders and {{ltv_total}} of love. Thank you. Genuinely.\n\nHere's what changes:\n\n- **Early access to drops:** 24 hours before the public.\n- **Free expedited shipping** on every order, forever.\n- **A direct line:** if you ever need anything, reply to this email — it goes to my inbox, not a ticket queue.\n- **Hand-written thank-you note** in your next order.\n\nNo card to activate, no points to accrue. You earned it by showing up.\n\n— {{founder_name}}, {{brand_name}}",
      category: "loyalty",
      variables: ["first_name", "brand_name", "order_count", "ltv_total", "founder_name"],
    },
    {
      name: "Win-Back (Day 1 of sequence)",
      subject: "Did we do something wrong, {{first_name}}?",
      body: "Hi {{first_name}},\n\nNoticed it's been a few months since your last {{brand_name}} order. Wanted to check in directly.\n\nWas there something off? Sizing, fit, ship times, customer service? If yes, hit reply and tell me — I'm {{founder_name}}, the {{founder_role}}, and I want to know.\n\nIf it's just life and timing, no worries. As a small thanks for past orders, here's 15% off your next purchase with code BACK15, no minimum, valid 14 days: {{shop_url}}\n\n— {{founder_name}}",
      category: "winback",
      variables: ["first_name", "brand_name", "founder_name", "founder_role", "shop_url"],
    },
  ],

  // ── 3 phone scripts ───────────────────────────────────────────────────
  call_scripts: [
    {
      name: "CS Escalation Call",
      scenario: "An order issue (lost, damaged, wrong item) escalated to phone after the customer wasn't satisfied with email support.",
      script:
        "Hi {{first_name}}, this is {{rep_name}} from {{brand_name}}. I saw your messages about {{issue_summary}} and I wanted to call directly because email wasn't cutting it. Sorry it got to this point.\n\nFirst — quick check: did anyone get back to you with the {{tracking / refund / replacement}} info yet? OK.\n\nHere's what I'm going to do, no asking you to wait or escalate further:\n\n1. {{specific_resolution_step_1}}.\n2. {{specific_resolution_step_2}}.\n3. {{specific_compensation_or_extra}}.\n\nThe replacement / refund / shipment will land in your account / mailbox by {{specific_date}}. If it doesn't, you have my direct line — {{rep_direct_phone}} — and you call me, not a queue.\n\nIs there anything else from this experience that we missed? I want to fix the root cause too, not just yours.\n\n[Listen.]\n\nThank you for sticking with us through the friction. I know it would have been easier to just chargeback. I appreciate you giving us a chance to make it right.",
      rationale:
        "CS escalations are retention gold IF you front-load resolution and compensation. The script works because it (a) doesn't ask the customer to repeat themselves, (b) commits to a specific date, (c) gives them a direct line, and (d) closes by asking for the root-cause feedback that makes the next customer's experience better.",
    },
    {
      name: "Retention Save Call (High-LTV at-risk)",
      scenario: "Calling a high-LTV customer who hasn't bought in 60+ days OR who left a 1-3 star review.",
      script:
        "Hi {{first_name}}, this is {{rep_name}} from {{brand_name}}. Don't worry — not selling anything. I'm calling because {{trigger_reason: you've been a loyal customer for X orders / I saw a review you left / I noticed you've been quiet for a while}}.\n\nGot 5 minutes? Promise short.\n\n[Yes]\n\n{{If review: I read your review and I want to dig deeper — can you walk me through what happened?}}\n{{If lapsed: Just want to ask — was there something we did or stopped doing that you wish we'd handle differently?}}\n\n[Listen carefully. Don't defend.]\n\nThat's really useful. Specifically what I'm going to do with that:\n\n1. {{specific_action_taken_inside_company}}.\n2. {{follow_up_with_customer}}.\n\nAnd as a thank-you for the time and the candor — {{specific_thank_you: free product / store credit / something custom}}. No strings.\n\nWe owe you. Thank you.",
      rationale:
        "Retention calls cost time but the LTV math is brutal: a saved high-LTV customer is worth 10x a new acquisition. The script avoids defensiveness and ends with a thank-you that's not a cynical 'come back, here's a discount' but actual gratitude.",
    },
    {
      name: "B2B / Wholesale Inquiry",
      scenario: "An inbound wholesale inquiry from a retailer, distributor, or corporate gifting buyer.",
      script:
        "Hi {{first_name}}, this is {{rep_name}} with {{brand_name}}. Thanks for reaching out about {{wholesale / corporate gifting / private label}}.\n\nQuick scoping questions, then I'll tell you whether we're a fit:\n\n1. What's your business — store, distributor, gifting program, something else?\n2. Initial volume you're thinking? Approximate units / month or per drop is fine.\n3. Timeline — are you stocking for {{season / event}}, or ongoing?\n4. Any custom packaging or co-branding requirements?\n5. Where will this be sold or distributed geographically?\n\n[Take notes. Don't pitch yet.]\n\nGreat. Based on that, here's the honest read:\n\n[If fit] We can absolutely do this. Our wholesale minimum is {{min_order}}, lead time is {{lead_time}}, and discount tiers are: {{discount_tier_summary}}. Want me to send the full wholesale deck + price list and put a proposal in front of you by {{specific_date}}?\n\n[If not fit yet] Honestly, you might be a bit small / large / out-of-region for our current wholesale program. Two options: (1) we have a {{alternative_program}} that might fit, or (2) we can re-evaluate in 6 months — drop me a calendar reminder. Either way, I'll send a 1-pager so you have it on file.",
      rationale:
        "B2B inquiries are lottery tickets — most don't go anywhere. The script qualifies in 5 questions, gives an honest yes-or-no inside the call, and provides a graceful 'not yet' that keeps the door open without wasting six weeks of back-and-forth.",
    },
  ],

  // ── Lead scoring rules (purchase intent) ──────────────────────────────
  scoring_rules: [
    {
      name: "Viewed product 3+ times",
      signal: "Same product page viewed 3 or more times by the same lead",
      score_delta: 12,
      dimension: "intent",
    },
    {
      name: "Added to cart (any item)",
      signal: "Lead has added at least one item to cart",
      score_delta: 18,
      dimension: "intent",
    },
    {
      name: "Cart abandoned (within 7d)",
      signal: "Lead added to cart but didn't complete checkout in last 7 days",
      score_delta: 15,
      dimension: "urgency",
    },
    {
      name: "Compared 2+ products",
      signal: "Lead viewed at least 2 products in same category — actively shopping",
      score_delta: 10,
      dimension: "intent",
    },
    {
      name: "First-time buyer (recent)",
      signal: "Made first purchase within last 30 days — high re-purchase potential",
      score_delta: 20,
      dimension: "fit",
    },
    {
      name: "Repeat buyer (3+ orders)",
      signal: "Has placed 3 or more orders historically",
      score_delta: 25,
      dimension: "fit",
    },
    {
      name: "VIP threshold ($500 LTV)",
      signal: "Lifetime value over $500",
      score_delta: 30,
      dimension: "fit",
    },
    {
      name: "Refunded last order",
      signal: "Last order was refunded — may be at-risk of churn",
      score_delta: -10,
      dimension: "intent",
    },
  ],

  // ── 10-module course: DTC Brand Growth Playbook ───────────────────────
  course: {
    title: "DTC Brand Growth Playbook",
    description:
      "A 10-module practitioner course on how DTC brands actually scale — through product, retention, paid acquisition, content, and operations. Heavy on what doesn't work (because most DTC content is recycled SaaS theory).",
    modules: [
      {
        title: "Module 1 — Product-Market Fit Signals (Pre-Scale)",
        description: "How to know if you actually have PMF before you spend on ads.",
        lessons: [
          {
            title: "The 4 PMF signals (repeat rate, organic %, CAC payback, NPS)",
            content_type: "video",
            duration_seconds: 540,
            content_body: "Specific thresholds for each signal. Below these, don't scale ads.",
          },
          {
            title: "When organic > paid (and when to flip)",
            content_type: "text",
            duration_seconds: 360,
            content_body: "Why organic-first brands outperform paid-first brands at the same revenue.",
          },
        ],
      },
      {
        title: "Module 2 — The Welcome Series",
        description: "First 3 emails do 60% of the lifetime value in many DTC programs. Don't phone them in.",
        lessons: [
          {
            title: "Welcome series anatomy: brand → proof → offer",
            content_type: "video",
            duration_seconds: 480,
            content_body: "Three-email structure with examples from 3 reference brands.",
          },
          {
            title: "Discount or no-discount? The data.",
            content_type: "text",
            duration_seconds: 300,
            content_body: "When the welcome discount helps and when it kills your margin permanently.",
          },
        ],
      },
      {
        title: "Module 3 — Cart Abandonment That Doesn't Train Discount-Seekers",
        description: "Three-touch sequence that recovers cart without making 'wait for the discount' a customer habit.",
        lessons: [
          {
            title: "1h soft + 24h discount + 72h SMS — and why",
            content_type: "video",
            duration_seconds: 540,
            content_body: "Why soft-touch first matters and how to time the discount correctly.",
          },
          {
            title: "Segmenting first-time vs repeat cart-abandoners",
            content_type: "text",
            duration_seconds: 300,
            content_body: "Different sequences for first-time vs repeat buyers. Repeat doesn't need a discount.",
          },
        ],
      },
      {
        title: "Module 4 — Post-Purchase: The Most Underbuilt Funnel",
        description: "Most brands stop after the order confirmation. That's where retention starts.",
        lessons: [
          {
            title: "Day 0, 7, 14, 30 — what to send",
            content_type: "video",
            duration_seconds: 600,
            content_body: "Specific email cadence and what each email does for retention metrics.",
          },
          {
            title: "Review requests that actually get responses",
            content_type: "text",
            duration_seconds: 300,
            content_body: "Subject line + incentive structure data from 1M+ review requests.",
          },
        ],
      },
      {
        title: "Module 5 — Win-Back Sequences",
        description: "Customers don't churn loudly. They just stop opening. How to bring them back.",
        lessons: [
          {
            title: "The 90-day lapse trigger",
            content_type: "video",
            duration_seconds: 480,
            content_body: "Why 90 days is the right threshold for most DTC categories (and when it isn't).",
          },
          {
            title: "Tiered offer escalation: 0 → 15% → 25%",
            content_type: "text",
            duration_seconds: 300,
            content_body: "Why discount escalation works on lapsed customers and trains exactly the right behavior.",
          },
        ],
      },
      {
        title: "Module 6 — VIP & Loyalty Programs (Without Points)",
        description: "Most points programs hurt margin and don't change behavior. The alternative.",
        lessons: [
          {
            title: "The 'no-points VIP' model (free-shipping + early-access)",
            content_type: "video",
            duration_seconds: 540,
            content_body: "How free shipping + 24h early access outperforms most points programs at higher margin.",
          },
          {
            title: "Hand-written notes: cost vs LTV impact",
            content_type: "text",
            duration_seconds: 240,
            content_body: "$3 of effort, +$80 of LTV. The math.",
          },
        ],
      },
      {
        title: "Module 7 — Paid Acquisition for DTC",
        description: "Where to spend on Meta + Google + TikTok in 2026.",
        lessons: [
          {
            title: "The 60-30-10 platform split",
            content_type: "video",
            duration_seconds: 600,
            content_body: "Suggested platform split based on category, AOV, and creative bandwidth.",
          },
          {
            title: "Creative testing: 9 variants per week minimum",
            content_type: "text",
            duration_seconds: 360,
            content_body: "Why brands that test 9+ creatives weekly outperform brands testing 2-3, and how to staff it.",
          },
        ],
      },
      {
        title: "Module 8 — UGC & Community-Generated Content",
        description: "Customer content beats studio content for social ads. How to source it ethically.",
        lessons: [
          {
            title: "The 5-tier UGC pipeline",
            content_type: "video",
            duration_seconds: 480,
            content_body: "From organic mentions to seeded creators to paid UGC. When to use each.",
          },
          {
            title: "Whitelisting + spark code basics",
            content_type: "text",
            duration_seconds: 300,
            content_body: "How to run ads from creator accounts without legal mess.",
          },
        ],
      },
      {
        title: "Module 9 — Operations: Inventory, Shipping, Returns",
        description: "What kills brands isn't marketing. It's ops.",
        lessons: [
          {
            title: "Inventory math: 8-week vs 12-week buffer",
            content_type: "video",
            duration_seconds: 540,
            content_body: "Cash-flow tradeoffs and how to model the cost of stockouts vs holding cost.",
          },
          {
            title: "The 30-day returns policy that doesn't get abused",
            content_type: "text",
            duration_seconds: 300,
            content_body: "Policy structure that's customer-friendly and abuse-resistant.",
          },
        ],
      },
      {
        title: "Module 10 — Wholesale & Marketplace Expansion",
        description: "When to go retail, when to stay DTC-only.",
        lessons: [
          {
            title: "DTC vs wholesale margin comparison",
            content_type: "video",
            duration_seconds: 540,
            content_body: "Walkthrough of the margin and cash-cycle differences. Which fits which growth stage.",
          },
          {
            title: "Amazon: yes, no, or hybrid",
            content_type: "text",
            duration_seconds: 360,
            content_body: "When Amazon helps, when it cannibalises DTC, and the hybrid models that work.",
          },
        ],
      },
    ],
  },

  // ── 5-step funnel: ad → product → checkout → upsell → repeat purchase
  funnel: {
    name: "Paid Ad to Repeat Customer",
    description:
      "Captures paid traffic on a high-converting product page, runs a one-click upsell on checkout, and routes new customers into the post-purchase + repeat-purchase nurture.",
    steps: [
      {
        title: "Paid Ad Landing (Product Page)",
        step_type: "opt-in",
        description: "High-converting PDP optimised for paid traffic — UGC above the fold, social proof, clear CTA.",
      },
      {
        title: "Product Detail / Add-to-Cart",
        step_type: "qualifier",
        description: "Variant selection, sizing guidance, ATC. Captures email for cart abandonment if user bounces.",
      },
      {
        title: "Checkout",
        step_type: "checkout",
        description: "Frictionless checkout. Apple Pay / Shop Pay top of stack. Express options for repeat customers.",
      },
      {
        title: "One-Click Upsell (Post-Purchase)",
        step_type: "upsell",
        description: "Post-purchase upsell page offering a complementary item at 15-20% off, one-click add.",
      },
      {
        title: "Repeat-Purchase Nurture",
        step_type: "thank-you",
        description: "Triggers post-purchase sequence: confirmation → ship update → review request → upsell on day 7.",
      },
    ],
  },
};
