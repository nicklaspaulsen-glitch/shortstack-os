-- Onboarding personalization: AI-generated follow-up questions + answers
-- Adds two jsonb columns to the profiles table so the Step 5 "Personalize" flow
-- (in both agency and solo onboarding) can persist its AI-generated questions
-- and the user's answers. Downstream content generation, copywriter prompts,
-- and the AI copilot system prompt read from these columns via
-- src/lib/personalization.ts::getUserPersonalization.

alter table profiles add column if not exists onboarding_personalization jsonb default '{}'::jsonb;
alter table profiles add column if not exists onboarding_ai_answers jsonb default '{}'::jsonb;
