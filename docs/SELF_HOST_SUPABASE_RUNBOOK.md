# Self-host Supabase runbook (Postgres + GoTrue + Realtime)

Goal: run our own Supabase stack on a Hetzner VPS, in parallel with
the Vercel-replacement Coolify host (see
[SELF_HOST_VERCEL_RUNBOOK.md](./SELF_HOST_VERCEL_RUNBOOK.md)).
This is the second leg of the cost-optimization push.

> **TL;DR** — Self-hosted Supabase on a CX21 (€5.83/mo) saves the
> $25/mo Pro tier and gives us hands-on access to Postgres. We trade
> away the dashboard, branching, and managed point-in-time recovery.
> **Do not rush this.** Self-hosting auth = self-hosting your users'
> trust.

## Before you read further

This runbook assumes you've shipped the
[Vercel self-host runbook](./SELF_HOST_VERCEL_RUNBOOK.md) **first**.
Doing both at once doubles the blast radius.

## Why move

| Factor                 | Supabase Cloud (Pro)                    | Self-hosted on Hetzner               |
| ---------------------- | --------------------------------------- | ------------------------------------ |
| Base price             | $25/mo (Pro)                            | $5.83/mo (CX21) or $13.83 (CX31)     |
| Compute                | 2 vCPU shared / 8 GB on Pro            | 2 vCPU dedicated / 4 GB (CX21)       |
| DB egress              | $0.09/GB after 250 GB                   | Hetzner: 20 TB included              |
| Backups                | Daily PITR, 7-day retention             | We script `pg_dump` to R2            |
| Branching              | Yes (Pro feature)                       | No                                   |
| Edge Functions         | Yes (Deno runtime)                      | We re-implement as Next.js routes    |
| Dashboard              | Polished                                | Skipped — pgAdmin or psql + Studio   |
| Realistic monthly      | **$25–60** at our load                  | **$6–14**                            |

**Estimated savings: $20–50/mo.**

### What we lose

- **Managed PITR.** We replace with `pg_dump --format=custom` nightly
  to R2 + a `wal-g` continuous archive.
- **Branching.** We use a `CREATE DATABASE shortstack_dev` schema
  instead, or a separate ephemeral Postgres container per PR.
- **Studio dashboard.** Self-hosted Supabase ships a Studio container,
  but it's slower and doesn't get updates as fast. For day-to-day,
  TablePlus / Postico / `psql` directly.
- **Edge Functions.** We don't use them today (everything is Next.js
  API routes). Skip the `functions` container.
- **Auto-pause.** Cloud Supabase pauses idle projects on free tier.
  Our Pro tier doesn't auto-pause; self-hosted obviously doesn't.

### What we keep / add

- **Same Postgres**, just an instance we control. Migrations work
  unchanged via the existing `supabase/migrations/*.sql` files.
- **Same client SDKs** (`@supabase/supabase-js`,
  `@supabase/ssr`) — just point them at our self-hosted URL.
- **Realtime**, **GoTrue (auth)**, **PostgREST**, **Storage API** —
  all run as Docker containers from the official compose.

## Prerequisites

- [ ] Comfortable with Docker, Docker Compose, and basic Postgres
      ops (psql, pg_dump, RLS).
- [ ] A second Hetzner CX21 (or CX31 — see "Sizing" below).
- [ ] Domain `db.shortstack.work` available in Cloudflare.
- [ ] R2 bucket `shortstack-backups` already provisioned with a
      `db/` prefix.
- [ ] `wal-g` familiarity if you want continuous WAL archiving (we
      do — it's how we get PITR).

## Sizing

| Workload                            | Box      | RAM     | vCPU  | Disk  | €/mo    |
| ----------------------------------- | -------- | ------- | ----- | ----- | ------- |
| < 100k rows, < 5 RPS                | CX21     | 4 GB    | 2     | 40 GB | 5.83    |
| < 1M rows, < 25 RPS                 | CX31     | 8 GB    | 3     | 80 GB | 13.83   |
| 1–10M rows, < 100 RPS               | CX41     | 16 GB   | 4     | 160 GB | 25.18  |
| > 10M rows or > 100 RPS sustained   | CCX23    | 16 GB   | 4 dedicated | 160 GB | 47.50 |

We're well inside CX21 territory today. Plan to upgrade to CX31
before we cross 100k orders or 50 concurrent users.

## Step 1 — Provision the VPS

1. Hetzner Cloud → same project (`shortstack-prod`) → new server.
2. Image: Ubuntu 24.04 LTS.
3. Type: **CX21** to start.
4. Region: same as the Coolify box (latency between app and DB
   matters more than DB-to-user). Both in `nbg1`.
5. SSH key, public IPv4, public IPv6.
6. **Add a 40 GB volume** at create time. Mount it at `/data`. This
   is where Postgres + Storage objects + WAL live, separate from the
   OS disk so disk-full on `/` doesn't take down DB.
7. Apply the same Hetzner Cloud Firewall as the Coolify box, but:
   - **Only allow inbound TCP 22 and 5432** (and 80/443 if you want
     the Studio container reachable). Source for 5432: the Coolify
     server's static IP. Source for 22: your office IP (or
     Tailscale).
   - **Do not** expose 5432 publicly — Cloudflare doesn't proxy raw
     Postgres traffic, and a public 5432 will be probed within
     minutes.

```bash
ssh root@<db-server-ip>
apt update && apt upgrade -y
reboot
```

After reboot:

```bash
ssh root@<db-server-ip>
# Format and mount the data volume
mkfs.ext4 /dev/sdb            # check `lsblk` for the actual device
mkdir -p /data
echo '/dev/sdb /data ext4 defaults 0 0' >> /etc/fstab
mount -a

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

## Step 2 — Clone the official Supabase Docker bundle

```bash
cd /opt
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

The compose stack at `supabase/docker/docker-compose.yml` includes:

- `db` — Postgres 17 with the Supabase extensions (pg_graphql,
  pg_jsonschema, pgsodium, etc.).
- `auth` — GoTrue.
- `rest` — PostgREST.
- `realtime` — Phoenix-based Realtime server.
- `storage` — File storage API (we'll point it at R2).
- `studio` — Optional dashboard.
- `kong` — API gateway in front of `auth` / `rest` / `realtime` /
  `storage`. Public traffic hits Kong, never the individual services.
- `meta` — pg-meta service for the dashboard.
- `imgproxy` — On-the-fly image transforms (skip if storage is on R2
  with separate transforms).
- `vector` — Log shipping (optional).
- `analytics` (Logflare) — Optional.

We can disable `studio`, `imgproxy`, `analytics`, `vector`, and
`functions` to shave RAM. Edit `docker-compose.yml`:

```yaml
# Comment out or delete `studio`, `imgproxy`, `analytics`, `vector`,
# `functions`, and `meta` services.
```

## Step 3 — Configure `.env`

Open `/opt/supabase/docker/.env` and set:

```bash
############
# Database
############
POSTGRES_PASSWORD=<32-char random>
JWT_SECRET=<64-char random>          # Used by GoTrue + PostgREST
ANON_KEY=<JWT signed with JWT_SECRET, role=anon>
SERVICE_ROLE_KEY=<JWT signed with JWT_SECRET, role=service_role>

############
# Studio
############
DASHBOARD_USERNAME=<admin>
DASHBOARD_PASSWORD=<32-char random>

############
# API
############
API_EXTERNAL_URL=https://db.shortstack.work
SUPABASE_PUBLIC_URL=https://db.shortstack.work
SITE_URL=https://app.shortstack.work
ADDITIONAL_REDIRECT_URLS=https://app.shortstack.work/**

############
# Auth
############
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false       # we send confirmation emails
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=<resend api key>
SMTP_SENDER_NAME=ShortStack
SMTP_ADMIN_EMAIL=ops@shortstack.work

############
# OAuth providers (mirror cloud config)
############
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<google client id>
GOTRUE_EXTERNAL_GOOGLE_SECRET=<google secret>
# ...repeat for each provider you use today.

############
# Storage (point at R2)
############
STORAGE_BACKEND=s3
GLOBAL_S3_BUCKET=shortstack-storage
GLOBAL_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
GLOBAL_S3_PROTOCOL=https
GLOBAL_S3_FORCE_PATH_STYLE=true
AWS_ACCESS_KEY_ID=<r2 access key>
AWS_SECRET_ACCESS_KEY=<r2 secret>
AWS_DEFAULT_REGION=auto
```

Generate the JWT keys with:

```bash
# Anon JWT
node -e "
  const jwt = require('jsonwebtoken');
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60*60*24*365*10; // 10 years
  console.log('ANON_KEY=' + jwt.sign({ role: 'anon', iss: 'supabase', iat: now, exp }, 'YOUR_JWT_SECRET'));
  console.log('SERVICE_ROLE_KEY=' + jwt.sign({ role: 'service_role', iss: 'supabase', iat: now, exp }, 'YOUR_JWT_SECRET'));
"
```

Or use the official key generator: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys

## Step 4 — Move Postgres data dir to the volume

The compose file defaults to a Docker named volume. We want
Postgres on `/data` so it's on the larger, separate disk:

```yaml
# In docker-compose.yml under the `db` service:
services:
  db:
    volumes:
      - /data/postgres:/var/lib/postgresql/data
```

Make sure the directory exists and is owned by 999:

```bash
mkdir -p /data/postgres
chown 999:999 /data/postgres
```

## Step 5 — Bring up the stack

```bash
cd /opt/supabase/docker
docker compose pull
docker compose up -d
docker compose logs -f db | head -100   # confirm Postgres started clean
```

Expected: Postgres logs `database system is ready to accept connections`,
GoTrue logs `Server started on 0.0.0.0:9999`, etc.

## Step 6 — DNS + reverse proxy

We don't expose Kong directly. Put Coolify's Traefik in front, on the
**same** Coolify box, so users see one origin and TLS terminates
once.

1. In Cloudflare DNS:
   - `db.shortstack.work` → A record pointing at the **Coolify**
     server IP, **proxied** (orange cloud).
2. In Coolify → Resources → **+ Service** → **Custom Docker Compose**:

   ```yaml
   services:
     supabase-proxy:
       image: traefik:v3.1
       command:
         - "--providers.file.directory=/etc/traefik/dynamic"
         - "--entrypoints.websecure.address=:443"
       labels:
         - traefik.enable=true
         - traefik.http.routers.supabase.rule=Host(`db.shortstack.work`)
         - traefik.http.services.supabase.loadbalancer.server.url=http://<db-server-ip>:8000
   ```

   Or simpler: add an Application in Coolify with the Compose file
   above, enable the domain `db.shortstack.work`, and let Coolify's
   built-in Traefik issue the cert.

3. Lock down `5432`. Only the Coolify origin server's IP can reach
   port 5432 of the DB box. Direct DB access from your laptop is via
   SSH tunnel:

   ```bash
   ssh -L 5432:localhost:5432 root@<db-server-ip>
   psql postgresql://postgres:<password>@localhost:5432/postgres
   ```

## Step 7 — Migrate the schema

Our migrations are in `supabase/migrations/*.sql`. Apply them in
order:

```bash
# Locally, with the Coolify-side Next.js app pointed at the new DB
# (we'll do that in Step 9), or via the Supabase CLI:
supabase db push --db-url "postgresql://postgres:<password>@<db-ip>:5432/postgres"
```

Or, if the CLI doesn't suit, run them by hand:

```bash
ls supabase/migrations | sort | while read f; do
  psql -h <db-ip> -U postgres -d postgres -f "supabase/migrations/$f"
done
```

> **Warning:** the cloud Supabase project has migrations applied via
> the MCP tool that may not be in the file tree. Compare with
> `mcp__8fb03bb5-...__list_migrations` before assuming the file
> tree is the source of truth.

## Step 8 — Migrate auth (users)

GoTrue stores users in the `auth` schema. Cloud Supabase doesn't let
you `pg_dump` the `auth` schema directly via the dashboard, but the
underlying Postgres does — use the connection string:

```bash
# From your laptop (with the cloud DB password in $CLOUD_PG_PASSWORD)
pg_dump \
  --host=<cloud-host> \
  --port=5432 \
  --username=postgres \
  --no-owner \
  --schema=auth \
  --data-only \
  --table='auth.users' \
  --table='auth.identities' \
  --table='auth.refresh_tokens' \
  --table='auth.sessions' \
  --table='auth.mfa_factors' \
  --table='auth.mfa_challenges' \
  --table='auth.flow_state' \
  --no-acl \
  -f auth-export.sql

# Import to the new DB
psql -h <db-ip> -U postgres -d postgres -f auth-export.sql
```

After import:

- Re-issue every user's session (they'll all be signed out — this is
  unavoidable because `JWT_SECRET` changed).
- Send a "we're upgrading our infrastructure, please sign in again"
  email.
- Confirm the password hashes match (GoTrue uses bcrypt; the format
  is portable).

## Step 9 — Switch the app over

In Coolify → Application → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://db.shortstack.work
NEXT_PUBLIC_SUPABASE_ANON_KEY=<new ANON_KEY from Step 3>
SUPABASE_SERVICE_ROLE_KEY=<new SERVICE_ROLE_KEY from Step 3>
```

Trigger a redeploy. The Next.js app now reads from the self-hosted
Supabase. Watch the application logs for:

- `auth/session 401` spikes — expected, since user sessions are
  invalidated.
- DB errors — confirm RLS policies are intact (re-run any policy
  migrations if necessary).
- Realtime connections — every `useEffect(() => sb.channel(...))`
  call should re-establish.

## Step 10 — Storage

If we use Supabase Storage for any uploads (avatar, brand assets):

1. Bulk-export current storage objects from cloud Supabase to R2:

   ```bash
   # Use rclone with the Supabase storage S3 endpoint
   rclone sync supabase-cloud:bucket-name r2:shortstack-storage --progress
   ```

2. Confirm the `STORAGE_BACKEND=s3` config from Step 3 points at R2.
3. Update any hardcoded `https://<old-supabase-project>.supabase.co/storage/...`
   URLs in the DB:

   ```sql
   UPDATE clients
   SET logo_url = REPLACE(logo_url,
     'https://jkttomvrfhomhthetqhh.supabase.co/storage/v1/object/public/',
     'https://db.shortstack.work/storage/v1/object/public/'
   )
   WHERE logo_url LIKE '%jkttomvrfhomhthetqhh%';
   -- Repeat for every column that may hold storage URLs.
   ```

## Step 11 — Realtime

Realtime config lives in the `realtime` container. Most of our
subscriptions are simple `INSERT`/`UPDATE` on user-owned tables —
they need:

- `ALTER TABLE <name> REPLICA IDENTITY FULL;` on each table the
  client subscribes to. Look for `.channel("...").on("postgres_changes", ...)`
  in the codebase to find them.

```sql
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE conversation_messages REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
-- ...etc
```

Verify with:

```bash
docker compose logs realtime | grep -i 'subscriber'
```

## Step 12 — Backups

Two layers:

### Nightly logical backup (`pg_dump`)

```bash
# /opt/scripts/pg-backup.sh
#!/usr/bin/env bash
set -euo pipefail
TS=$(date -u +%Y%m%d-%H%M%S)
OUT=/data/backups/db-${TS}.dump
mkdir -p /data/backups
pg_dump -U postgres -F c --compress=9 -f "$OUT" postgres
aws s3 cp "$OUT" "s3://shortstack-backups/db/${TS}.dump" \
  --endpoint-url=https://<account>.r2.cloudflarestorage.com
# Retain 14 local + 90 in R2; R2 lifecycle rule handles remote retention.
find /data/backups -mtime +14 -delete
```

Crontab: `0 2 * * *`.

### Continuous WAL archive (`wal-g`)

For point-in-time recovery to any second in the last 14 days:

```bash
apt install -y wal-g
# /etc/wal-g.json
{
  "WALG_S3_PREFIX": "s3://shortstack-backups/wal/",
  "AWS_ACCESS_KEY_ID": "<r2 key>",
  "AWS_SECRET_ACCESS_KEY": "<r2 secret>",
  "AWS_ENDPOINT": "https://<account>.r2.cloudflarestorage.com",
  "AWS_S3_FORCE_PATH_STYLE": "true",
  "WALG_COMPRESSION_METHOD": "lz4"
}
```

In `postgresql.conf` (inside the `db` container's volume):

```
archive_mode = on
archive_command = 'wal-g wal-push %p'
archive_timeout = 60
```

A `wal-g backup-push /data/postgres` weekly gives a base backup. WAL
segments stream up continuously. Restore is `wal-g backup-fetch
/data/postgres LATEST` followed by `wal-g wal-fetch`.

**Test the restore**, end-to-end, before going to production. A
backup you've never restored from is not a backup.

## Step 13 — Monitoring

- **Better Stack Heartbeats**: cron a `psql -c 'SELECT 1'` every
  minute and ping a heartbeat URL. Miss two = page on-call.
- **pg_stat_statements** + **Coolify metrics dashboard** for slow
  queries.
- Hetzner Cloud → server detail → CPU + RAM + disk graphs.

For deeper observability, run the official `supabase/grafana` stack
in a separate compose project on the same VPS — it pre-wires Postgres
exporters to Grafana.

## Trade-offs cheat-sheet

| Feature                      | Cloud Supabase | Self-hosted              |
| ---------------------------- | -------------- | ------------------------ |
| Managed Studio dashboard     | Yes            | Optional (we disabled)   |
| Branching (`supabase branches`)| Yes          | No                       |
| PITR (managed)               | Yes (Pro)      | Manual via wal-g         |
| Vault (secrets)              | Yes            | Self-hosted pgsodium     |
| Edge Functions               | Yes            | Re-implemented as routes |
| Auto-pause                   | Yes (free)     | No                       |
| Read replicas                | Pro            | Manual setup             |
| Status page                  | Yes            | Build your own           |
| Vendor support               | Email + Discord| You + me                 |

## Rollback plan

If self-hosted DB shows trouble:

1. **Application env vars** → revert
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` to the cloud values. Coolify
   redeploys in ~60 seconds.
2. **Auth state** — sessions issued by self-hosted GoTrue are signed
   with a different `JWT_SECRET` than cloud GoTrue. After rollback,
   users sign in once more.
3. **Data delta** — any rows written to self-hosted that aren't in
   cloud are lost on rollback **unless** we run a reverse `pg_dump`
   to merge. Practically: run cloud and self-hosted in
   write-shadow during the cutover window, then promote one as
   canonical. The shadow phase is non-trivial and we should plan for
   downtime instead.
4. **R2 storage** — unchanged, since R2 is the underlying store
   either way.

## Migration sequence (4-week ramp)

### Week 1 — Parallel stand-up

- Provision the DB box.
- Apply schema migrations to a fresh DB.
- Smoke-test Realtime, Auth, Storage from a *separate* dev branch of
  the app.

### Week 2 — Auth migration dry-run

- Export users from cloud Supabase to a staging copy of self-hosted.
- Verify a user can sign in on staging using their existing password.
- Confirm RLS policies fire correctly.
- Re-export and re-import a fresh dump the day before cutover.

### Week 3 — Cutover

- Announce 30-minute maintenance window.
- Final `pg_dump` + import.
- Update Coolify env vars, redeploy.
- Issue a "please sign in again" notification.
- Watch error rates for 48 hours.

### Week 4 — Decommission cloud Supabase

- Confirm parity for 7 days minimum.
- Pause the cloud project (don't delete — keep it as a hot read-only
  reference for at least 30 days).
- After 30 days of no incidents, downgrade to free tier or delete.

## Cost projection (annual)

| Item                          | Cloud Supabase Pro | Self-hosted on Hetzner |
| ----------------------------- | ------------------ | ---------------------- |
| Subscription                  | $25                | $5.83 (CX21)           |
| Egress / bandwidth            | ~$5                | $0                     |
| Backup storage (R2)           | $0.60              | $0.60                  |
| `wal-g` storage (R2)          | $0                 | $0.20                  |
| **Per-month total**           | **$30**            | **$7**                 |
| **Per-year total**            | **$360**           | **$84**                |
| **Annual savings**            | —                  | **~$275**              |

Combined with the Vercel migration runbook, total annual savings
land in the **$2,000–2,800/year** range, paying for the time to
self-host within ~2–3 months.

## When **not** to self-host Supabase

- You have < 30 minutes/month of ops attention to give.
- You haven't shipped a production Postgres before.
- Your team can't be paged if the DB box dies.
- Your customer contracts require SOC 2 / ISO 27001 — managed
  Supabase has those, your VPS doesn't.

If any of those is true, **stay on managed**. The $25/month is
cheaper than a 3 AM outage.

## Post-cutover checklist

- [ ] `psql -h db.shortstack.work -U postgres -c 'SELECT 1'` returns 1.
- [ ] App can sign in a test user against the new GoTrue.
- [ ] A Realtime channel emits `INSERT` events on `conversations`.
- [ ] Storage upload to a Storage bucket lands in R2.
- [ ] Nightly `pg_dump` shipped to R2 visible in the dashboard.
- [ ] `wal-g wal-push` running every minute (check `pg_stat_archiver`).
- [ ] All RLS policies green (`SELECT * FROM pg_policies WHERE schemaname = 'public'` count matches expected).
- [ ] Migration files in `supabase/migrations/` match
      `pg_dump --schema-only` output (no drift).
- [ ] Better Stack heartbeat green for 24 consecutive hours.
- [ ] Cloud Supabase project paused (not deleted).
