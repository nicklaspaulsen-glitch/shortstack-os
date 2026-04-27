# Self-host Vercel runbook (Coolify on Hetzner)

Goal: replace Vercel as the **compute** provider for ShortStack OS while
keeping every other piece of the stack intact (Supabase, Cloudflare,
R2, Stripe webhooks, etc.). This is a cost-optimization move first,
control move second.

> **TL;DR** — Hetzner CX31 + Coolify runs the Next.js app for ~$14 per
> month. We keep Supabase as a managed service for now (a separate
> runbook covers self-hosting that). Migration is a four-week ramp,
> not a flip.

## Why move

| Factor                | Vercel (Pro)                          | Coolify on Hetzner CX31           |
| --------------------- | ------------------------------------- | --------------------------------- |
| Base price            | $20/seat plus usage                   | **$13.83/mo flat (3 vCPU, 8 GB)** |
| Bandwidth             | $0.40/GB after 1 TB                   | 20 TB included, $1.10/TB after    |
| Edge functions        | Included, but per-invocation billable | N/A — single-region origin only   |
| Build minutes         | $40/mo per 6,000 min                  | Included, no cap                  |
| Image optimization    | $5 per 1k extra transformations       | Included, no cap                  |
| Cron jobs             | Free (limited)                        | Included, unlimited               |
| Realistic monthly     | **$180–240** at our current load      | **$14**                           |

**Estimated savings: $100–180/mo**, even after we factor in incidental
costs (block storage for backups, Cloudflare Pro if needed, on-call
attention budget).

### What we lose

- **Multi-region edge.** Vercel auto-replicates static assets and
  serverless functions across PoPs. Coolify is a single VPS in one
  Hetzner location. We compensate with Cloudflare in front.
- **Preview URLs per branch.** Replaced with manual `git push
  feature/x` + a separate Coolify "Preview" application that pulls
  from any branch.
- **Vercel Analytics + Speed Insights.** Replace with Plausible or
  Cloudflare Web Analytics (already free).
- **Auto-rollback on failed deploy.** Coolify has rollback but it's a
  one-click action, not automatic.

### What we keep

- **Supabase** — unchanged. The DB lives at
  `jkttomvrfhomhthetqhh.supabase.co` and our Next.js app talks to it
  the same way.
- **Cloudflare DNS + R2 + WAF** — unchanged.
- **Stripe webhooks** — re-pointed to the new origin.
- **GitHub Actions** — unchanged for tests; deploy step is replaced
  by a Coolify webhook.

## Prerequisites

Before you start, make sure you have:

- [ ] A Hetzner Cloud account (https://accounts.hetzner.com/signUp).
- [ ] Cloudflare control over `shortstack.work` and `app.shortstack.work`.
- [ ] SSH keys uploaded to Hetzner (`ssh-keygen` then add public key
      via Hetzner Console → SSH Keys).
- [ ] A read-only fork of the latest production env-var dump
      (`vercel env pull .env.production` from the existing Vercel
      project — mirror this 1:1 in Coolify).
- [ ] Local `vercel` CLI, `git`, `ssh`, `curl` installed.

## Step 1 — Provision the VPS

1. Create a new Hetzner Cloud project named `shortstack-prod`.
2. Add a server:
   - **Image:** Ubuntu 24.04 LTS (Noble Numbat).
   - **Type:** CX31 (3 vCPU, 8 GB RAM, 80 GB SSD) — €11.09/mo plus
     IPv4 (€0.60/mo); regions don't change the price.
   - **Region:** `nbg1` (Nuremberg) for best latency to most EU users.
     Pick `hil` (Hillsboro, US) or `ash` (Ashburn, US) if your traffic
     is US-heavy.
   - **Networking:** "Public IPv4" + "Public IPv6", default firewall
     (we'll lock it down below).
   - **SSH key:** select your uploaded key.
   - **Cloud-init (User data):** leave empty.
   - **Volumes:** none yet — we'll add a 40 GB volume for backups in
     Step 7.
3. Wait ~30 seconds for boot, then `ssh root@<server-ip>` to confirm
   you can log in. Run `apt update && apt upgrade -y` once and reboot.
4. Add a Hetzner Cloud Firewall (Network → Firewalls → Create):
   - Inbound: TCP 22, 80, 443. Source: `0.0.0.0/0, ::/0`. Tag: "web".
   - Outbound: allow all.
   - Apply to your server.

## Step 2 — Install Coolify

Coolify is a single-host PaaS that wraps Docker, Traefik, and webhook
deploys behind a friendly UI.

```bash
ssh root@<server-ip>
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

This script (verify the latest URL at https://coolify.io/docs/installation)
installs Docker, the Coolify control plane, and Traefik. It creates
admin credentials in `/data/coolify/source/.env` — note them down.

After install, navigate to `http://<server-ip>:8000` and complete the
admin onboarding. Set:

- **Instance domain:** `coolify.shortstack.work` (we'll add DNS in Step 3).
- **Admin email + strong password.**
- **Two-factor auth:** enable it immediately (Settings → Profile →
  Two-factor).

## Step 3 — Cloudflare DNS

In Cloudflare DNS for `shortstack.work`:

| Type | Name      | Content        | Proxy        | TTL    |
| ---- | --------- | -------------- | ------------ | ------ |
| A    | `app`     | `<server-ip>`  | Proxied (orange) | Auto |
| A    | `coolify` | `<server-ip>`  | DNS only (grey)  | Auto |
| AAAA | `app`     | `<server-ipv6>`| Proxied         | Auto  |

Why mixed proxy modes:

- `app.shortstack.work` is **proxied** so Cloudflare's WAF, caching,
  and DDoS shield are in front of the origin.
- `coolify.shortstack.work` is **grey-clouded** (DNS-only). Coolify's
  own UI uses Let's Encrypt with HTTP-01 challenge — the easiest way
  to make that work is to skip Cloudflare's proxy.

In Cloudflare → SSL/TLS → Overview, set encryption mode to **Full
(strict)**. Anything weaker exposes us to MITM between Cloudflare and
the origin.

Add a Cloudflare WAF custom rule (Security → WAF → Custom rules) to
block direct origin access — Cloudflare passes a header
`X-Forwarded-Host: app.shortstack.work` only when the request came
through their proxy, so:

```
(http.request.uri.path eq "/api/webhooks/stripe" and http.request.headers["x-forwarded-host"] ne "app.shortstack.work")
```

This is belt-and-braces — also restrict the origin firewall in Step
8 to only accept traffic from Cloudflare IP ranges.

## Step 4 — Connect GitHub

1. In Coolify, **Sources** → **+ New** → **GitHub App**.
2. Click "Register a new GitHub App", scope it to the
   `nicklaspaulsen-glitch/shortstack-os` repo, and approve.
3. Coolify will auto-fill the App ID and private key — save.
4. **Projects** → **+ New** → **Application**. Choose the GitHub
   source and the `shortstack-os` repo. Pick branch `main`.

## Step 5 — Configure the build

Coolify auto-detects Next.js from `package.json`. Confirm the build
config:

- **Build pack:** `Nixpacks` (auto). Override to `Dockerfile` only if
  you need fully custom builds.
- **Build command:** `npm ci && npm run build`
- **Start command:** `npm start`
- **Port:** `3000` (Next.js default).
- **Health check:** `GET /api/healthz` returning 200. We already have
  this at `src/app/api/healthz/route.ts`.

Add a `.coolify/build.sh` script if any pre-build step is needed
(e.g. generating types from Supabase). Optional for our setup.

## Step 6 — Import environment variables

You can either paste them one-by-one into Coolify's UI, or bulk import:

```bash
# Locally, with the existing Vercel project linked:
vercel env pull --environment=production .env.production

# Strip Vercel-only vars that won't apply
sed -i '/^VERCEL_/d;/^NEXT_PUBLIC_VERCEL/d' .env.production
```

In Coolify → Application → **Environment Variables**:

1. Click "Bulk add".
2. Paste the contents of `.env.production`.
3. Mark these as **runtime-only** (not bundled at build):
   - `STRIPE_SECRET_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `CRON_SECRET`
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `WHATSAPP_ACCESS_TOKEN`
   - any other `_SECRET` / `_KEY` / `_TOKEN`.
4. Mark these as **build-time + runtime** (Next.js inlines `NEXT_PUBLIC_*`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` → set to `https://app.shortstack.work`
5. Add `NODE_ENV=production`.
6. Delete any leftover `VERCEL_*` from the export.

## Step 7 — Domain + SSL

1. **Application → Domains** → add `app.shortstack.work`.
2. Coolify auto-issues a Let's Encrypt cert (HTTP-01). Wait for the
   green check (~30 seconds).
3. The Cloudflare proxy already terminates TLS for end users — the
   internal Coolify cert is what Cloudflare connects to in
   `Full (strict)` mode.

## Step 8 — Lock down the firewall

Coolify is now serving traffic. We want to make sure **only Cloudflare**
can reach the origin port 443.

```bash
ssh root@<server-ip>
# UFW is the simplest. Coolify allows port 22, 80, 443 by default.
# Restrict 80/443 to Cloudflare IP ranges.
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp                                      # SSH from anywhere

# Pull Cloudflare's IP list (regenerate this monthly via cron)
for ip in $(curl -sf https://www.cloudflare.com/ips-v4); do
  ufw allow from "$ip" to any port 80,443 proto tcp comment 'cloudflare'
done
for ip in $(curl -sf https://www.cloudflare.com/ips-v6); do
  ufw allow from "$ip" to any port 80,443 proto tcp comment 'cloudflare'
done
ufw --force enable
```

For Coolify's own UI on `coolify.shortstack.work` (DNS-only), allow
your office IP only:

```bash
ufw allow from <your-static-ip> to any port 8000 proto tcp comment 'coolify-admin'
```

If you don't have a static IP, use the Coolify built-in OAuth/SSO and
keep port 8000 open behind a strong password.

## Step 9 — Webhooks

Re-point any external webhooks pointing at `*.vercel.app`:

| Provider                | Old URL                                                | New URL                                                |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Stripe                  | `https://app.shortstack.work/api/webhooks/stripe`      | unchanged (DNS does the work)                          |
| Resend (Svix)           | `https://app.shortstack.work/api/webhooks/resend`      | unchanged                                              |
| ElevenLabs              | `https://app.shortstack.work/api/webhooks/elevenlabs`  | unchanged                                              |
| Twilio voice/SMS        | `https://app.shortstack.work/api/webhooks/twilio`      | unchanged                                              |
| Discord bot             | `https://app.shortstack.work/api/webhooks/discord`     | unchanged                                              |
| GitHub (Coolify deploy) | n/a                                                    | added by Coolify automatically                         |

Because the public hostname is unchanged, every external webhook
target keeps working as soon as DNS flips. **This is the entire reason
we use the same domain on both sides.**

## Step 10 — Cron jobs

Vercel cron is configured in `vercel.json` — it'll be ignored on the
new origin. Coolify exposes a "Scheduled Tasks" tab on every
application. Mirror the schedule:

| Path                         | Cron         | Notes                              |
| ---------------------------- | ------------ | ---------------------------------- |
| `/api/cron/daily-briefing`   | `0 7 * * *`  | Daily briefing fan-out             |
| `/api/cron/daily-brief`      | `0 6 * * *`  | Telegram morning brief             |
| `/api/cron/weekly-report`    | `0 9 * * 1`  | Weekly report (Mondays 09:00 UTC)  |
| `/api/cron/sweep-stale-jobs` | `*/15 * * * *` | Stale job sweeper                |

Each scheduled task is an HTTP call from the Coolify host to
`https://app.shortstack.work/<path>` with header
`Authorization: Bearer $CRON_SECRET`. Coolify supports curl-style
templates — paste `Authorization: Bearer ${CRON_SECRET}` and Coolify
substitutes the env var at run time.

After cutover, **delete the cron block from `vercel.json`** and add a
note (`# moved to Coolify scheduled tasks 2026-XX-XX`).

## Step 11 — Image optimization

Next.js `next/image` works the same on Coolify — sharp does the
optimization in-process. Confirm:

- `next.config.mjs` has the production image domains listed.
- The CX31 has 8 GB RAM. Sharp can spike RAM during large image
  transforms; if you OOM, add a 4 GB swap file:

```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

This is fine for occasional spikes — for sustained image load,
upgrade to CX41 ($25/mo).

## Step 12 — Monitoring

For the first 90 days, run **two** independent uptime checkers:

1. **UptimeRobot** (free) — pings `https://app.shortstack.work/api/healthz`
   every 5 minutes from multiple PoPs. Email + Slack alerts.
2. **Better Stack Heartbeat** (free tier) — Coolify sends a heartbeat
   from each cron job. If the cron skips, you get paged.
3. Coolify's own dashboard for CPU / RAM / disk graphs.

For application logs, Coolify aggregates per-container logs in the UI.
For long-term retention, ship them to **Better Stack Logs** (free 1
GB/mo) via a `vector.toml` sidecar:

```toml
[sources.coolify]
type = "docker_logs"
include_containers = ["shortstack-os"]

[sinks.betterstack]
type = "http"
inputs = ["coolify"]
uri = "https://in.logs.betterstack.com"
auth.strategy = "bearer"
auth.token = "${BETTERSTACK_LOGS_TOKEN}"
encoding.codec = "json"
```

## Step 13 — Backups

The app itself is stateless — all data is in Supabase. The only
local state on the VPS is:

- Coolify's own DB (`/data/coolify/source/db/`) — backed up via
  Coolify's built-in S3 backup (configure in Settings → Backups).
  Point at our R2 bucket (`shortstack-backups/coolify/`).
- Coolify-managed `.env` files — same backup path.

Schedule: nightly at 02:00 UTC, retain 14 days. Test the restore at
least once before flipping production.

## Migration sequence (4-week ramp)

The point of the ramp is to **not** burn the bridge until we've seen
the new origin survive a real production load.

### Week 1 — Stand up in parallel

- Days 1–3: Steps 1–8 above. Application up at
  `https://shortstack-os.preview.coolify.shortstack.work` with all env
  vars and crons firing into a sandbox Supabase project (clone of
  prod via `pg_dump`).
- Day 4: Manual smoke test — every page in the dashboard, every cron,
  every webhook. Compare metrics + logs side-by-side.
- Day 5: Engage k6 or Artillery for a load test. Target: 200 RPS with
  p95 < 600ms. CX31 should handle this with headroom; if not, scale
  to CX41 before going further.

### Week 2 — Shadow traffic

- Cloudflare → Workers → add a route on `app.shortstack.work/*` that
  *forks* 10% of GET requests to the Coolify origin while still
  serving the response from Vercel.
- The fork is read-only (mutating verbs route only to Vercel). We
  inspect the parallel Coolify response in logs to confirm parity.
- Watch Sentry, Better Stack, and Cloudflare Analytics for delta.

### Week 3 — Cut traffic 10% → 50% → 100%

- Move from shadow to active routing. Cloudflare Worker:

  ```js
  const COOLIFY_PERCENT = 10;  // 10, 50, 100 over the week
  if (Math.random() * 100 < COOLIFY_PERCENT) {
    return fetch(`https://coolify-origin.shortstack.work${pathname}`, request);
  }
  return fetch(request);
  ```

- Day 1–2: 10%. Watch for any 5xx delta or latency regression.
- Day 3–4: 50%. Same checks.
- Day 5: 100%. Promote the Coolify origin to be the canonical
  `app.shortstack.work` A record, drop the Worker.

### Week 4 — Decommission Vercel

- Verify uptime + error rate match (or beat) the 30-day baseline from
  Vercel.
- Pause cron jobs on Vercel (`vercel cron disable`).
- Set Vercel project to "Maintenance" (no production deploys).
- Wait 7 more days as a graveyard buffer.
- Delete the project from Vercel only after a clean 7-day window.

## Rollback plan

If Coolify origin shows trouble at any phase:

1. **Cloudflare DNS** → point `app.shortstack.work` back at Vercel
   (one-click in the dashboard, propagates in seconds because TTL
   = Auto).
2. **Vercel** → ensure the latest production deploy is still
   reachable. We never delete it during ramp.
3. **Webhooks** → unchanged, since the hostname is the same.
4. **Crons** → re-enable on Vercel via `vercel cron enable`. Coolify
   crons are idempotent on the API side, but disable them in Coolify
   to avoid double-fires.

The rollback path is intentionally cheap: the only durable state on
Coolify is its own admin DB, which we back up nightly. The application
itself is stateless.

## Cost projection (annual)

| Item                          | Vercel today        | Coolify on Hetzner  |
| ----------------------------- | ------------------- | ------------------- |
| Compute / hosting             | $20 + usage         | $13.83 flat         |
| Bandwidth (est. 600 GB/mo)    | ~$80                | $0                  |
| Build minutes                 | $40 (overage tier)  | $0                  |
| Image optimization            | $5 (overage)        | $0                  |
| Edge functions / cron         | included            | included            |
| Backup volume (40 GB R2)      | $0.60 to R2         | $0.60 to R2         |
| Better Stack monitoring       | $0 (free tier)      | $0                  |
| **Per-month total**           | **$180–240**        | **$14–18**          |
| **Per-year total**            | **$2,160–2,880**    | **$170–215**        |
| **Annual savings**            | —                   | **~$2,000–2,650**   |

Even if we double the Hetzner box to CX41 (4 vCPU, 16 GB RAM,
$25.18/mo) the savings still clear $1,800/year.

## Post-cutover checklist

- [ ] DNS: `dig +short app.shortstack.work` returns the Cloudflare
      proxy IP (104.21.x.x or 172.67.x.x).
- [ ] Cloudflare → Origin Server cert installed in Coolify.
- [ ] All 4 cron tasks visible in Coolify Scheduled Tasks → Logs.
- [ ] Stripe webhook endpoint shows recent 200s in the Stripe
      dashboard (Stripe → Developers → Webhooks → "View attempts").
- [ ] Sentry / Better Stack alerts wired up.
- [ ] R2 backup bucket has a fresh nightly Coolify-state archive.
- [ ] `npm test` runs green from a fresh clone of `main`.
- [ ] Load test: `k6 run loadtest.js` clears 200 RPS @ p95 < 600ms.
- [ ] `vercel.json` cron block removed and committed.
- [ ] README updated to point to this runbook.
