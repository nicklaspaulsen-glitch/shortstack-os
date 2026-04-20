-- Faces storage bucket — used by /api/thumbnail/face-swap to store user-uploaded
-- selfies that get swapped into generated thumbnails. Public read (images are
-- referenced directly by the FLUX worker), but only the owner can write/delete
-- via RLS on storage.objects.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'faces',
  'faces',
  true,
  10485760, -- 10MB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Users upload/read their own face images under /faces/{profile_id}/...
-- Public bucket means the generated URL is fetchable by the RunPod worker,
-- but writes are still locked to the owner.

drop policy if exists "Users upload own faces" on storage.objects;
create policy "Users upload own faces"
  on storage.objects for insert
  with check (
    bucket_id = 'faces'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users read faces" on storage.objects;
create policy "Users read faces"
  on storage.objects for select
  using (bucket_id = 'faces');

drop policy if exists "Users delete own faces" on storage.objects;
create policy "Users delete own faces"
  on storage.objects for delete
  using (
    bucket_id = 'faces'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
