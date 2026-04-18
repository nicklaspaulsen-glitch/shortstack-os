-- Generated Images
-- Stores wizard-driven AI image generations (FLUX/SDXL on RunPod, Replicate, or DALL-E fallback).
-- Each row captures both the user's wizard answers and the final optimized prompt that was sent
-- to the image model so the user can re-tweak or regenerate later.

create table if not exists generated_images (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  prompt text,
  negative_prompt text,
  model text,
  width int,
  height int,
  image_url text,
  thumbnail_url text,
  wizard_answers jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  status text default 'pending' check (status in ('pending','processing','completed','failed')),
  error_message text,
  job_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_generated_images_profile on generated_images(profile_id);
create index if not exists idx_generated_images_client on generated_images(client_id);
create index if not exists idx_generated_images_status on generated_images(status);
create index if not exists idx_generated_images_created on generated_images(created_at desc);

alter table generated_images enable row level security;

create policy "Users manage own generated images"
  on generated_images for all
  using (auth.uid() = profile_id);
