# Self-Host Uptime Kuma — Public Status Auto-Sync

> Replace Pingdom ($15-$200/mo) with self-hosted Uptime Kuma. Bonus:
> Kuma webhooks pipe straight into ShortStack's `incidents` table so the
> public /status/[ownerSlug] page lights up automatically when a monitor
> goes red.
> **Expected savings:** Pingdom Starter ~$15/mo → Hetzner CX11 ~€4/mo.

## Why Uptime Kuma

- Self-hosted (single SQLite or MariaDB-backed Docker container)
- Built-in TCP / HTTP / DNS / Push / Steam / Postgres monitor types
- Browser dashboard and a public status-page subroute baked in
- Webhook notification type — POSTs JSON on every status change

The integration in this repo at
`src/app/api/integrations/uptime-kuma/webhook/route.ts` accepts those
POSTs and turns DOWN events into incidents on the `incidents` table that
the public /status page reads. Tenant resolution is via the `X-Owner-Id`
header (set per-monitor in Kuma's Notification config).

## Server sizing

Tiny. CX11 (1 vCPU / 2 GB / 20 GB) at ~€4/mo handles 50+ monitors with
a 60-second tick interval and HTTP keep-alives.

## docker-compose

`~/uptime/docker-compose.yml`:

```yaml
version: "3.8"

services:
  kuma:
    image: louislam/uptime-kuma:1
    ports:
      - "127.0.0.1:3001:3001"
    volumes:
      - kuma-data:/app/data
    restart: unless-stopped

volumes:
  kuma-data:
```

```bash
cd ~/uptime
docker compose up -d
```

That's it. Visit `http://localhost:3001` to bootstrap an admin account.
Caddy reverse-proxy in front:

```caddy
status-monitor.example.com {
  reverse_proxy 127.0.0.1:3001
  encode zstd gzip
}
```

## Set up the ShortStack webhook secret

```bash
# Generate the secret
openssl rand -hex 32

# Set in Vercel for production
vercel env add UPTIME_KUMA_WEBHOOK_SECRET production
# Paste the hex value
```

## Add a Notification type

In Kuma:

1. **Settings → Notifications → Setup Notification**
2. Notification Type: **Webhook**
3. Friendly Name: `ShortStack incidents`
4. Post URL: `https://app.shortstack.work/api/integrations/uptime-kuma/webhook`
5. Request Body: **Application Form Data → JSON**

Custom Headers (paste verbatim — these are the part Kuma calls "Custom
Headers" on the notification form):

```
Content-Type: application/json
X-Owner-Id: <agency-owner-uuid-here>
X-Uptime-Signature: sha256=<HMAC-of-body — see below>
```

Kuma 1.23+ supports an HMAC body-signing flag. Enable it under the
notification setup (toggle "Sign requests with HMAC") and paste the
hex secret you generated above. If you're on an older Kuma version
without that toggle, upgrade — fail-closed signature checking is the
whole point.

Save. Click **Test** — the ShortStack route returns 200 with
`{"ok":true,"ignored":true,"reason":"no monitor name or non-actionable status"}`
for the test payload. Real events will create or resolve incidents.

## Add monitors

The minimum useful set for ShortStack:

| Monitor name      | Type   | Target                                                            | Interval |
| ----------------- | ------ | ----------------------------------------------------------------- | -------- |
| `app.shortstack.work` | HTTP-S | `https://app.shortstack.work`                                  | 60s      |
| `api/health`         | HTTP-S | `https://app.shortstack.work/api/health`                       | 60s      |
| `cron/health-check`  | HTTP-S | `https://app.shortstack.work/api/cron/health-check?ping=1`     | 5min     |
| `Supabase`           | HTTP-S | `https://jkttomvrfhomhthetqhh.supabase.co/auth/v1/health`      | 60s      |
| `Resend`             | HTTP-S | `https://api.resend.com`                                        | 5min     |

For each monitor:
1. Add it
2. **Conditions tab** → expected status `200` for HTTP, healthy timing
3. **Notifications tab** → check the `ShortStack incidents` notification

Use the monitor's **name** as the component label. The webhook receiver
maps that name 1:1 into `incidents.affected_components`, which is what
the public page renders in its component grid. Pick names you want users
to see (e.g. `Email`, `Outreach`, `Webhooks`) rather than internal
monitor codes.

## What happens on an outage

1. Kuma marks `app.shortstack.work` as DOWN at T+0s.
2. Kuma POSTs to `/api/integrations/uptime-kuma/webhook` with
   `monitor.status === 0`.
3. ShortStack inserts an `incidents` row with severity `investigating`
   and `affected_components = ["app.shortstack.work"]`.
4. The public `/status/<owner>` page picks the new row up on its next
   ISR revalidate (60s) and shows a yellow banner.
5. When the monitor flips back UP, Kuma POSTs status `1` and ShortStack
   updates the same incident row to `resolved` with `resolved_at = now()`.
6. The public page green-lights again on next revalidate.

## Operational notes

- **Don't put more than ~50 monitors on a CX11.** The HTTP keep-alive
  pool is fine but Kuma's web UI gets sluggish past 50 with 60s ticks.
  Bump to CX21 if you hit that.
- **Watch your ICMP monitors** — Kuma supports them but they add a
  privileged-process dependency. Stick to HTTPS unless you genuinely need
  ICMP.
- **The webhook tolerates flapping** — if a monitor flips DOWN→UP→DOWN→UP
  inside one minute, you get ONE incident row that opens and resolves
  with the latest timestamps. No churn.
- **Rotation** — to rotate the secret, change `UPTIME_KUMA_WEBHOOK_SECRET`
  in Vercel + the matching value in Kuma simultaneously. There's a brief
  window where in-flight requests will 401; that's acceptable.

## Backups

Kuma's DB is a single SQLite file at `/app/data/kuma.db` inside the
container, mapped to the `kuma-data` volume. Snapshot it nightly:

```bash
docker compose exec kuma sqlite3 /app/data/kuma.db ".backup /app/data/kuma-$(date +%F).bak"
docker cp uptime-kuma-1:/app/data/kuma-$(date +%F).bak ./backups/
```

Stash to R2 with `rclone copy backups/ r2:shortstack-backups/uptime-kuma/`.
