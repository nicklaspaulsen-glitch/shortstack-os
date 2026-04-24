-- Activity Feed — Instagram-style internal creative activity
-- Five tables: activity_events, activity_reactions, activity_comments,
-- activity_follows, activity_read_state.
--
-- org_id ≈ the agency owner (profiles.id). Event visibility is either:
--   - 'org'              — visible to agency owner + team_members of same org
--   - 'project_members'  — visible only to members of the linked project_board
--   - 'public'           — visible to any signed-in profile (future use)
--
-- Do NOT execute this file. It is applied via Supabase migrations pipeline.

-- ============================================================
-- activity_events
-- ============================================================
create table if not exists activity_events (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references profiles(id) on delete cascade,
  actor_id         uuid references profiles(id) on delete set null,
  event_type       text not null check (event_type in (
                     'asset_created',
                     'asset_derived',
                     'project_launched',
                     'project_completed',
                     'milestone_hit',
                     'client_approved',
                     'client_requested_revisions',
                     'review_submitted',
                     'review_session_created',
                     'task_completed',
                     'task_assigned',
                     'member_joined',
                     'hire_booked',
                     'post_mortem_published',
                     'scope_flag_raised',
                     'scope_flag_resolved',
                     'weekly_report_sent',
                     'case_study_published'
                   )),
  subject_type     text,
  subject_id       uuid,
  subject_preview  jsonb not null default '{}'::jsonb,
  project_id       uuid,
  visibility       text not null default 'org'
                     check (visibility in ('org','project_members','public')),
  created_at       timestamptz not null default now()
);

create index if not exists idx_activity_events_org_created
  on activity_events (org_id, created_at desc);
create index if not exists idx_activity_events_project_created
  on activity_events (project_id, created_at desc);
create index if not exists idx_activity_events_actor_created
  on activity_events (actor_id, created_at desc);
create index if not exists idx_activity_events_subject
  on activity_events (subject_type, subject_id);

alter table activity_events enable row level security;

-- Helper: resolve the caller's "effective org" (team_member → parent agency)
create or replace function activity_effective_org(uid uuid)
returns uuid
language sql
stable
as $$
  select coalesce(
    (select parent_agency_id from profiles where id = uid and role = 'team_member' and parent_agency_id is not null),
    uid
  );
$$;

drop policy if exists "activity_events select" on activity_events;
create policy "activity_events select" on activity_events
  for select using (
    (visibility = 'public')
    or (visibility = 'org' and org_id = activity_effective_org(auth.uid()))
    or (visibility = 'project_members' and project_id is not null and exists (
         select 1 from project_boards b
          where b.id = activity_events.project_id
            and b.user_id = activity_effective_org(auth.uid())
       ))
  );

drop policy if exists "activity_events insert" on activity_events;
create policy "activity_events insert" on activity_events
  for insert with check (
    org_id = activity_effective_org(auth.uid())
  );

drop policy if exists "activity_events delete owner" on activity_events;
create policy "activity_events delete owner" on activity_events
  for delete using (
    org_id = auth.uid()
  );


-- ============================================================
-- activity_reactions
-- ============================================================
create table if not exists activity_reactions (
  event_id    uuid not null references activity_events(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id, emoji)
);

create index if not exists idx_activity_reactions_event on activity_reactions (event_id);
create index if not exists idx_activity_reactions_user  on activity_reactions (user_id);

alter table activity_reactions enable row level security;

drop policy if exists "activity_reactions select" on activity_reactions;
create policy "activity_reactions select" on activity_reactions
  for select using (
    exists (select 1 from activity_events e where e.id = activity_reactions.event_id)
  );

drop policy if exists "activity_reactions insert own" on activity_reactions;
create policy "activity_reactions insert own" on activity_reactions
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from activity_events e where e.id = activity_reactions.event_id)
  );

drop policy if exists "activity_reactions delete own" on activity_reactions;
create policy "activity_reactions delete own" on activity_reactions
  for delete using (user_id = auth.uid());


-- ============================================================
-- activity_comments
-- ============================================================
create table if not exists activity_comments (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references activity_events(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete set null,
  content     text not null,
  created_at  timestamptz not null default now(),
  edited_at   timestamptz,
  deleted_at  timestamptz
);

create index if not exists idx_activity_comments_event_created
  on activity_comments (event_id, created_at asc);

alter table activity_comments enable row level security;

drop policy if exists "activity_comments select" on activity_comments;
create policy "activity_comments select" on activity_comments
  for select using (
    exists (select 1 from activity_events e where e.id = activity_comments.event_id)
  );

drop policy if exists "activity_comments insert own" on activity_comments;
create policy "activity_comments insert own" on activity_comments
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from activity_events e where e.id = activity_comments.event_id)
  );

drop policy if exists "activity_comments update own" on activity_comments;
create policy "activity_comments update own" on activity_comments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "activity_comments delete own" on activity_comments;
create policy "activity_comments delete own" on activity_comments
  for delete using (user_id = auth.uid());


-- ============================================================
-- activity_follows
-- ============================================================
create table if not exists activity_follows (
  user_id      uuid not null references profiles(id) on delete cascade,
  subject_type text not null check (subject_type in ('user','project','tag')),
  subject_id   uuid not null,
  followed_at  timestamptz not null default now(),
  primary key (user_id, subject_type, subject_id)
);

create index if not exists idx_activity_follows_subject
  on activity_follows (subject_type, subject_id);

alter table activity_follows enable row level security;

drop policy if exists "activity_follows manage own" on activity_follows;
create policy "activity_follows manage own" on activity_follows
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ============================================================
-- activity_read_state
-- ============================================================
create table if not exists activity_read_state (
  user_id       uuid primary key references profiles(id) on delete cascade,
  last_read_at  timestamptz not null default now()
);

alter table activity_read_state enable row level security;

drop policy if exists "activity_read_state manage own" on activity_read_state;
create policy "activity_read_state manage own" on activity_read_state
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
