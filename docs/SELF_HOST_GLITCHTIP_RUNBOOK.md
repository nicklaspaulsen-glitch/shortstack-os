# Self-Host GlitchTip — Sentry-Compatible Error Tracking

> Ship `reportError()` events to a self-hosted GlitchTip instead of paying
> for Sentry cloud. Drop-in: same DSN format, same wire protocol.
> **Expected savings:** Sentry team plan ~$26/mo → Hetzner CX21 ~€5/mo.

## Why GlitchTip

GlitchTip implements the Sentry ingest API. The `error-reporter.ts` helper
in `src/lib/observability/error-reporter.ts` POSTs raw envelopes to
whatever DSN you set — no SDK lock-in. Switching from Sentry cloud to
GlitchTip is one env-var change: rotate `SENTRY_DSN`. No code redeploy
beyond the env update.

The trade-off vs Sentry cloud: no source-map symbolication (you ship
sourcemaps via Vercel anyway), no performance tracing, fewer integrations.
For a small ops team that just wants a "did anything explode in prod"
dashboard, that's fine.

## Server sizing

| Tier        | RAM   | Disk  | Cost      | Good for                |
| ----------- | ----- | ----- | --------- | ----------------------- |
| Hetzner CX21 | 4 GB  | 40 GB | ~€5/mo  | Up to ~50K events/month |
| Hetzner CX31 | 8 GB  | 80 GB | ~€11/mo | Up to ~250K events/month |

Start on CX21. The biggest cost driver is Postgres + Redis memory; bump
when retention queries get slow.

## docker-compose

Place this at `~/glitchtip/docker-compose.yml`. The Postgres password and
Django secret key are placeholders — generate real ones with
`openssl rand -hex 32`.

```yaml
version: "3.8"

x-environment: &default-environment
  DATABASE_URL: postgres://glitchtip:${POSTGRES_PASSWORD}@postgres:5432/glitchtip
  SECRET_KEY: ${DJANGO_SECRET_KEY}
  PORT: "8000"
  EMAIL_URL: ${EMAIL_URL:-consolemail://}
  GLITCHTIP_DOMAIN: https://glitchtip.example.com
  DEFAULT_FROM_EMAIL: glitchtip@example.com
  CELERY_WORKER_AUTOSCALE: "1,3"
  CELERY_WORKER_MAX_TASKS_PER_CHILD: "10000"
  ENABLE_USER_REGISTRATION: "false"   # Lock down — only invite users you trust
  ENABLE_ORGANIZATION_CREATION: "false"

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: glitchtip
      POSTGRES_USER: glitchtip
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pg-data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  web:
    image: glitchtip/glitchtip:latest
    depends_on: [postgres, redis]
    ports:
      - "127.0.0.1:8000:8000"
    environment: *default-environment
    volumes:
      - uploads:/code/uploads
    restart: unless-stopped

  worker:
    image: glitchtip/glitchtip:latest
    command: ./bin/run-celery-with-beat.sh
    depends_on: [postgres, redis]
    environment: *default-environment
    volumes:
      - uploads:/code/uploads
    restart: unless-stopped

  migrate:
    image: glitchtip/glitchtip:latest
    depends_on: [postgres]
    command: ./bin/run-migrate.sh
    environment: *default-environment

volumes:
  pg-data:
  uploads:
```

Place secrets in `~/glitchtip/.env`:

```bash
POSTGRES_PASSWORD=<openssl rand -hex 24>
DJANGO_SECRET_KEY=<openssl rand -hex 48>
EMAIL_URL=smtp://USER:PASS@smtp.resend.com:587
```

Bring it up:

```bash
docker compose --env-file .env up -d
docker compose --env-file .env run --rm migrate ./manage.py createsuperuser
```

## Reverse-proxy with Caddy

```caddy
glitchtip.example.com {
  reverse_proxy 127.0.0.1:8000
  encode zstd gzip
  request_body {
    max_size 10MB
  }
}
```

Caddy auto-renews the TLS cert. Done.

## Generating a DSN

1. Log in as the superuser.
2. Create an Organization → Project (name it `shortstack-prod`).
3. Click the project, then **Settings → Client Keys (DSN)**.
4. Copy the DSN. Format: `https://<publicKey>@glitchtip.example.com/<projectId>`.

Set it in Vercel:

```bash
vercel env add SENTRY_DSN production
# Paste the DSN
vercel env add SENTRY_DSN preview     # optional — only if you want preview errors too
```

To switch back to Sentry cloud, replace the DSN value. No redeploy needed
beyond env propagation.

## Retention tuning

Default retention in GlitchTip is 90 days. For a small ops setup, 30
days is plenty and cuts disk pressure. Set in the project's
**Settings → Project Details → Event Retention** dropdown.

For automatic cleanup, GlitchTip's celery-beat already runs the cleanup
task daily — no extra cron needed.

## What NOT to send

The error reporter scrubs keys matching `token|secret|password|api_key|authorization|cookie|bearer`
in the context object, but you must still avoid passing:

- Full request bodies (PII risk + 10 MB limit upstream)
- JWT access tokens (even in tags — log keys can leak)
- Stripe `metadata` blobs verbatim — pass IDs, not the whole object
- Email subject lines or HTML bodies (customer content)
- Webhook payload `raw` JSON — pass the event id and type only

The helper is NOT a PII firewall. Callers are responsible for keeping
the `context` object slim. See the wired call sites in
`src/app/api/webhooks/stripe-connect/route.ts`,
`src/lib/voice/router.ts`, `src/lib/ai/llm-router.ts` for the right
shape: small map of route + component + relevant ids.

## Sample-rate control

If you start ingesting too many events, set `SENTRY_SAMPLE_RATE=0.25` in
Vercel to drop 75% at the helper level. The variable is honored without
a redeploy (it's read on every call).

## Switching back to Sentry

Replace `SENTRY_DSN` with the Sentry cloud DSN. The wire protocol is the
same. No code changes. Done.

## Backups

```bash
# Nightly Postgres dump → S3-compatible R2 bucket
docker compose exec -T postgres pg_dump -U glitchtip glitchtip | \
  gzip | \
  rclone rcat r2:shortstack-backups/glitchtip-$(date +%F).sql.gz
```

Schedule via cron on the host: `0 4 * * * cd ~/glitchtip && ./backup.sh`.
