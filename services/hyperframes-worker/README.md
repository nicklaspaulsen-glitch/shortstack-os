# hyperframes-worker

Long-lived Node service that renders Hyperframes compositions to MP4. Runs
on a RunPod pod (or any host with headless Chrome + FFmpeg + Node >=22)
because the hyperframes CLI cannot execute inside Vercel serverless limits.

## Architecture

```
  /dashboard/video/composer        (Next.js UI)
            |
            v POST /api/video/composer/compositions/:id/render
  ShortStack Next.js API           (Vercel)
            |
            v POST https://<pod>/render   (Authorization: Bearer <secret>)
  hyperframes-worker               (RunPod pod, this service)
            |
            +- npx hyperframes render <html> -o output.mp4
            +- upload to Supabase Storage bucket
            +- POST back to ShortStack with output_url + metadata
                 (Authorization: Bearer <secret>)
```

## Env vars

| Var                         | Required | Description                                |
| --------------------------- | -------- | ------------------------------------------ |
| `PORT`                      | no       | Listen port (default 8080)                 |
| `WORKER_SECRET`             | yes      | Must match `RUNPOD_HYPERFRAMES_SECRET`     |
| `SUPABASE_URL`              | yes      | Your Supabase project URL                  |
| `SUPABASE_SERVICE_ROLE_KEY` | yes      | Service role key (for storage upload)      |
| `SUPABASE_STORAGE_BUCKET`   | no       | Bucket name (default `hyperframes-renders`)|

## Pod setup (quick)

1. Base image: any Ubuntu 22.04 + Node 22 + FFmpeg + Chromium.
2. `git clone` or copy this directory onto the pod.
3. `cd hyperframes-worker && npm install`
4. Export the env vars above.
5. `npm start`

## ShortStack env vars

Set on the Vercel project that hosts ShortStack:

- `RUNPOD_HYPERFRAMES_URL` - e.g. `https://xxx-8080.proxy.runpod.net`
- `RUNPOD_HYPERFRAMES_SECRET` - the same value as `WORKER_SECRET` above

If these are unset, the ShortStack UI will still create render rows but
mark them as queued and surface a visible warning.

## Supabase Storage

Create a public bucket named `hyperframes-renders` in Supabase (or whatever
you set `SUPABASE_STORAGE_BUCKET` to). Anyone with the output URL can view
the MP4.

## Health check

```
GET  /health        -> { ok: true, worker: "hyperframes" }
POST /render        -> accepts render job (see src/server.js for payload)
```
