-- Asset Library — unified home for every deliverable.
-- Central `assets` table auto-populated from source tables (generations, generated_images,
-- video_projects, portal_uploads, ai_output_handoffs) via AFTER INSERT triggers.
--
-- Per CLAUDE.md the codebase uses `profiles(id)` as the effective owner key.
-- This migration keeps the brief's `org_id` column name but stores the effective
-- owner profile id there (the same value `getEffectiveOwnerId` returns).
--
-- NOTE: this migration is NOT executed by the feature branch — it's checked in
-- for review + manual apply via Supabase MCP.

-- ============================================================================
-- assets
-- ============================================================================
create table if not exists public.assets (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null,
  project_id         uuid,
  asset_type         text not null check (asset_type in ('image','video','audio','doc','link','3d','other')),
  source             text not null check (source in (
                       'ai_generated','uploaded','gdrive','dropbox','external',
                       'from_review','from_thumbnail_tool','from_copywriter','other'
                     )),
  storage_url        text,
  thumbnail_url      text,
  filename           text,
  mime_type          text,
  size_bytes         bigint default 0,
  tags               text[] default '{}'::text[],
  description        text,
  ai_metadata        jsonb default '{}'::jsonb,
  original_asset_id  uuid references public.assets(id) on delete set null,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  tsv tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(filename,'') || ' ' ||
      coalesce(description,'') || ' ' ||
      array_to_string(coalesce(tags, '{}'::text[]), ' ')
    )
  ) stored
);

create index if not exists idx_assets_org_type         on public.assets(org_id, asset_type);
create index if not exists idx_assets_org_project      on public.assets(org_id, project_id);
create index if not exists idx_assets_tags_gin         on public.assets using gin (tags);
create index if not exists idx_assets_created_at       on public.assets(created_at desc);
create index if not exists idx_assets_original         on public.assets(original_asset_id);
create index if not exists idx_assets_tsv_gin          on public.assets using gin (tsv);
create index if not exists idx_assets_org_not_deleted  on public.assets(org_id) where deleted_at is null;

alter table public.assets enable row level security;

-- SELECT: org members (owner + their team_members)
drop policy if exists "assets_select_org" on public.assets;
create policy "assets_select_org" on public.assets
  for select using (
    auth.uid() = org_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.parent_agency_id = public.assets.org_id
    )
  );

-- INSERT: owner or team member
drop policy if exists "assets_insert_org" on public.assets;
create policy "assets_insert_org" on public.assets
  for insert with check (
    auth.uid() = org_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.parent_agency_id = public.assets.org_id
    )
  );

-- UPDATE: creator or org admin
drop policy if exists "assets_update_creator_or_admin" on public.assets;
create policy "assets_update_creator_or_admin" on public.assets
  for update using (
    auth.uid() = created_by
    or auth.uid() = org_id
  ) with check (
    auth.uid() = created_by
    or auth.uid() = org_id
  );

-- DELETE: creator or org admin (soft-delete in practice via update deleted_at)
drop policy if exists "assets_delete_creator_or_admin" on public.assets;
create policy "assets_delete_creator_or_admin" on public.assets
  for delete using (
    auth.uid() = created_by
    or auth.uid() = org_id
  );

-- updated_at trigger
create or replace function public.assets_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_assets_touch on public.assets;
create trigger trg_assets_touch before update on public.assets
  for each row execute function public.assets_touch_updated_at();

-- ============================================================================
-- asset_tags
-- ============================================================================
create table if not exists public.asset_tags (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  name        text not null,
  color       text default '#C9A84C',
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);

create index if not exists idx_asset_tags_org on public.asset_tags(org_id);

alter table public.asset_tags enable row level security;

drop policy if exists "asset_tags_select_org" on public.asset_tags;
create policy "asset_tags_select_org" on public.asset_tags
  for select using (
    auth.uid() = org_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.parent_agency_id = public.asset_tags.org_id
    )
  );

drop policy if exists "asset_tags_write_org" on public.asset_tags;
create policy "asset_tags_write_org" on public.asset_tags
  for all using (
    auth.uid() = org_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.parent_agency_id = public.asset_tags.org_id
    )
  ) with check (
    auth.uid() = org_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.parent_agency_id = public.asset_tags.org_id
    )
  );

-- ============================================================================
-- asset_collections
-- ============================================================================
create table if not exists public.asset_collections (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  name         text not null,
  description  text,
  created_by   uuid,
  created_at   timestamptz not null default now()
);

create index if not exists idx_asset_collections_org on public.asset_collections(org_id, created_at desc);

alter table public.asset_collections enable row level security;

drop policy if exists "asset_collections_select_org" on public.asset_collections;
create policy "asset_collections_select_org" on public.asset_collections
  for select using (
    auth.uid() = org_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.parent_agency_id = public.asset_collections.org_id
    )
  );

drop policy if exists "asset_collections_write_org" on public.asset_collections;
create policy "asset_collections_write_org" on public.asset_collections
  for all using (
    auth.uid() = org_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.parent_agency_id = public.asset_collections.org_id
    )
  ) with check (
    auth.uid() = org_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.parent_agency_id = public.asset_collections.org_id
    )
  );

-- ============================================================================
-- asset_collection_items
-- ============================================================================
create table if not exists public.asset_collection_items (
  collection_id  uuid not null references public.asset_collections(id) on delete cascade,
  asset_id       uuid not null references public.assets(id) on delete cascade,
  position       integer not null default 0,
  added_at       timestamptz not null default now(),
  primary key (collection_id, asset_id)
);

create index if not exists idx_collection_items_collection on public.asset_collection_items(collection_id, position);
create index if not exists idx_collection_items_asset      on public.asset_collection_items(asset_id);

alter table public.asset_collection_items enable row level security;

drop policy if exists "collection_items_select_via_parent" on public.asset_collection_items;
create policy "collection_items_select_via_parent" on public.asset_collection_items
  for select using (
    exists (
      select 1 from public.asset_collections c
      where c.id = asset_collection_items.collection_id
        and (
          auth.uid() = c.org_id
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.parent_agency_id = c.org_id
          )
        )
    )
  );

drop policy if exists "collection_items_write_via_parent" on public.asset_collection_items;
create policy "collection_items_write_via_parent" on public.asset_collection_items
  for all using (
    exists (
      select 1 from public.asset_collections c
      where c.id = asset_collection_items.collection_id
        and (
          auth.uid() = c.org_id
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.parent_agency_id = c.org_id
          )
        )
    )
  ) with check (
    exists (
      select 1 from public.asset_collections c
      where c.id = asset_collection_items.collection_id
        and (
          auth.uid() = c.org_id
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.parent_agency_id = c.org_id
          )
        )
    )
  );

-- ============================================================================
-- Auto-indexer triggers — only wire up when the source table exists.
-- ============================================================================

-- generations (Copywriter, Email Composer, Carousel, Thumbnail Studio, ...)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'generations'
  ) then
    create or replace function public.assets_from_generations()
    returns trigger language plpgsql security definer as $fn$
    declare
      v_type   text;
      v_source text;
    begin
      v_type := case
        when new.category in ('thumbnail','image','social_post') then 'image'
        when new.category = 'video'                               then 'video'
        when new.category in ('email','ad_copy','script','landing_page') then 'doc'
        else 'other'
      end;
      v_source := case
        when new.source_tool ilike '%thumbnail%' then 'from_thumbnail_tool'
        when new.source_tool ilike '%copywrit%'  then 'from_copywriter'
        else 'ai_generated'
      end;

      insert into public.assets (
        org_id, asset_type, source, filename, description,
        ai_metadata, created_by, created_at
      ) values (
        new.user_id,
        v_type,
        v_source,
        new.title,
        new.content_preview,
        jsonb_build_object(
          'origin_table', 'generations',
          'origin_id', new.id,
          'category', new.category,
          'source_tool', new.source_tool,
          'metadata', new.metadata
        ),
        new.user_id,
        new.created_at
      );
      return new;
    end;
    $fn$;

    drop trigger if exists trg_assets_from_generations on public.generations;
    create trigger trg_assets_from_generations
      after insert on public.generations
      for each row execute function public.assets_from_generations();
  end if;
end $$;

-- generated_images (AI image wizard)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'generated_images'
  ) then
    create or replace function public.assets_from_generated_images()
    returns trigger language plpgsql security definer as $fn$
    begin
      if new.status is not null and new.status <> 'completed' then
        return new;
      end if;

      insert into public.assets (
        org_id, project_id, asset_type, source,
        storage_url, thumbnail_url, filename, description,
        ai_metadata, created_by, created_at
      ) values (
        new.profile_id,
        null,
        'image',
        'ai_generated',
        new.image_url,
        new.thumbnail_url,
        coalesce(nullif(new.prompt, ''), 'Generated image'),
        new.prompt,
        jsonb_build_object(
          'origin_table', 'generated_images',
          'origin_id', new.id,
          'model', new.model,
          'width', new.width,
          'height', new.height,
          'wizard_answers', new.wizard_answers,
          'metadata', new.metadata
        ),
        new.profile_id,
        new.created_at
      );
      return new;
    end;
    $fn$;

    drop trigger if exists trg_assets_from_generated_images on public.generated_images;
    create trigger trg_assets_from_generated_images
      after insert on public.generated_images
      for each row execute function public.assets_from_generated_images();
  end if;
end $$;

-- video_projects (AI video editor)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'video_projects'
  ) then
    create or replace function public.assets_from_video_projects()
    returns trigger language plpgsql security definer as $fn$
    begin
      insert into public.assets (
        org_id, asset_type, source,
        storage_url, filename, description,
        ai_metadata, created_by, created_at
      ) values (
        new.profile_id,
        'video',
        'ai_generated',
        new.render_url,
        coalesce(new.title, new.topic, 'Video project'),
        new.topic,
        jsonb_build_object(
          'origin_table', 'video_projects',
          'origin_id', new.id,
          'duration', new.duration,
          'style_preset', new.style_preset,
          'render_status', new.render_status
        ),
        new.profile_id,
        new.created_at
      );
      return new;
    end;
    $fn$;

    drop trigger if exists trg_assets_from_video_projects on public.video_projects;
    create trigger trg_assets_from_video_projects
      after insert on public.video_projects
      for each row execute function public.assets_from_video_projects();
  end if;
end $$;

-- portal_uploads (client uploads from portal)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'portal_uploads'
  ) then
    create or replace function public.assets_from_portal_uploads()
    returns trigger language plpgsql security definer as $fn$
    declare
      v_owner uuid;
      v_type  text;
    begin
      select c.profile_id into v_owner
      from public.clients c
      where c.id = new.client_id;

      if v_owner is null then
        v_owner := new.portal_user_id;
      end if;

      v_type := case
        when coalesce(new.content_type,'') ilike 'image/%' then 'image'
        when coalesce(new.content_type,'') ilike 'video/%' then 'video'
        when coalesce(new.content_type,'') ilike 'audio/%' then 'audio'
        else 'doc'
      end;

      insert into public.assets (
        org_id, asset_type, source,
        storage_url, filename, mime_type, size_bytes,
        ai_metadata, created_by, created_at
      ) values (
        v_owner,
        v_type,
        'uploaded',
        new.file_path,
        new.file_name,
        new.content_type,
        coalesce(new.file_size_bytes, 0),
        jsonb_build_object(
          'origin_table', 'portal_uploads',
          'origin_id', new.id,
          'client_id', new.client_id,
          'portal_user_id', new.portal_user_id
        ),
        new.portal_user_id,
        new.uploaded_at
      );
      return new;
    end;
    $fn$;

    drop trigger if exists trg_assets_from_portal_uploads on public.portal_uploads;
    create trigger trg_assets_from_portal_uploads
      after insert on public.portal_uploads
      for each row execute function public.assets_from_portal_uploads();
  end if;
end $$;

-- ai_output_handoffs
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_output_handoffs'
  ) then
    create or replace function public.assets_from_ai_handoffs()
    returns trigger language plpgsql security definer as $fn$
    declare
      v_type text;
    begin
      v_type := case
        when new.kind ilike '%image%' or new.kind ilike '%thumb%' then 'image'
        when new.kind ilike '%video%' then 'video'
        else 'doc'
      end;

      insert into public.assets (
        org_id, asset_type, source,
        filename, description,
        ai_metadata, created_by, created_at
      ) values (
        new.user_id,
        v_type,
        'ai_generated',
        'AI handoff: ' || new.kind,
        null,
        jsonb_build_object(
          'origin_table', 'ai_output_handoffs',
          'origin_id', new.id,
          'kind', new.kind,
          'payload', new.payload
        ),
        new.user_id,
        new.created_at
      );
      return new;
    end;
    $fn$;

    drop trigger if exists trg_assets_from_ai_handoffs on public.ai_output_handoffs;
    create trigger trg_assets_from_ai_handoffs
      after insert on public.ai_output_handoffs
      for each row execute function public.assets_from_ai_handoffs();
  end if;
end $$;
