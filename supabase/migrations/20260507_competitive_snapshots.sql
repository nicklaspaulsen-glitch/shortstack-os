-- competitive_snapshots
--
-- Stores point-in-time scrapes of competitor pages/sites along with
-- Claude-generated competitive intelligence. One row per scrape job.
--
-- Ownership: user_id = auth.users.id. RLS ensures users only see their own
-- snapshots. No cross-tenant data bleeds since every query is filtered by
-- auth.uid() automatically.
--
-- previous_snapshot_id enables diffing: the API route can look up the prior
-- snapshot for the same (user_id, competitor_id) pair and flag change_detected
-- when the AI detects meaningful drift in keyChanges or sentimentScore.

create table if not exists competitive_snapshots (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references auth.users(id) on delete cascade,
  competitor_id        text        not null,
  competitor_name      text        not null,
  url                  text        not null,
  scraped_at           timestamptz not null default now(),
  -- Raw markdown from Firecrawl — may be several pages concatenated for crawl jobs.
  markdown_content     text,
  -- CompetitorInsights JSON from Claude: { summary, keyChanges, pricingMentions,
  -- featureMentions, sentimentScore }
  ai_insights          jsonb,
  -- Set to true when the API detects meaningful change vs previous_snapshot_id.
  change_detected      boolean     not null default false,
  -- Links to the prior snapshot for the same competitor so change-detection can diff.
  previous_snapshot_id uuid        references competitive_snapshots(id)
);

-- Row-level security: each user owns their own snapshots.
alter table competitive_snapshots enable row level security;

create policy "Users own their snapshots"
  on competitive_snapshots
  for all
  using (auth.uid() = user_id);

-- Primary access pattern: latest N snapshots for a given user + competitor.
create index if not exists idx_competitive_snapshots_user_competitor_time
  on competitive_snapshots(user_id, competitor_id, scraped_at desc);

-- Secondary: all snapshots for a user sorted by time (dashboard feed).
create index if not exists idx_competitive_snapshots_user_time
  on competitive_snapshots(user_id, scraped_at desc);
