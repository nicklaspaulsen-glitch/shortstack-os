/**
 * Self-test fixtures for the multi-channel sequences engine.
 *
 * These don't run against the live DB — they live here so the cron self-test
 * can sanity-check the engine's pure functions (step shape parsing, condition
 * evaluation, template rendering) without depending on Supabase.
 *
 * Used by both the smoke test in /api/cron/self-test and the unit-test
 * harness if/when one's added.
 */
import type { SequenceStep } from "./types";

export const SAMPLE_MULTICHANNEL_STEPS: SequenceStep[] = [
  {
    type: "email",
    subject: "Quick question about {business_name}",
    body: "Hey {first_name}, I noticed {business_name} in {city}. Mind if I ask one question?",
    ai_personalize: false,
    delay_minutes: 0,
  },
  {
    type: "wait",
    delay_minutes: 60 * 24 * 2, // 2 days
  },
  {
    type: "exit_if",
    condition: { field: "lead.status", operator: "equals", value: "won" },
    reason: "deal won",
  },
  {
    type: "sms",
    body: "Hey {first_name}! Sent you a note — worth a 5-min chat?",
    delay_minutes: 60 * 24 * 1, // 1 day after the wait
  },
  {
    type: "dm",
    platform: "linkedin",
    body: "Hey {first_name}, also reaching you here in case email got buried.",
    delay_minutes: 60 * 24 * 2,
  },
  {
    type: "voice_call",
    notes: "Reference the email + DM. Ask about their {industry} growth goals.",
    delay_minutes: 60 * 24 * 1,
  },
  {
    type: "tag",
    action: "add",
    tag_id: "long_nurture",
  },
];

export const SAMPLE_RUN_ID = "00000000-0000-0000-0000-000000000000";
