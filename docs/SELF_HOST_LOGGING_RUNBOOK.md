# Self-Host Logging — Vector + ClickHouse + Grafana

> Replace Better Stack / Logtail ($25-$300/mo depending on volume) with a
> self-hosted log pipeline that ingests Vercel log drains directly.
> **Expected savings:** Better Stack $25-300/mo → Hetzner CX31 ~€11/mo.

## Architecture

```
Vercel app  ─[log drain HTTPS]─►  Vector (HTTP source)
                                     │
                                     ├─► ClickHouse (long-term storage + queries)
                                     │
                                     └─► Loki / S3 (optional cold archive)

Grafana ─[reads ClickHouse]─►  dashboards + alerts
```

Vector is the swiss-army-knife shipper. It receives Vercel's log drain
events, normalizes them, parses any JSON line emitted by `structuredLog`
(see `src/lib/observability/structured-log.ts`), and writes batched rows
into ClickHouse.

ClickHouse is the column store — fast queries over hundreds of millions
of log rows on a single CX31 box.

Grafana queries ClickHouse via the official ClickHouse data source plugin.

## Server sizing

| Tier        | RAM   | Disk   | Cost      | Throughput target           |
| ----------- | ----- | ------ | --------- | --------------------------- |
| Hetzner CX31 | 8 GB  | 80 GB  | ~€11/mo | Up to ~10K logs/sec sustained |
| Hetzner CX41 | 16 GB | 160 GB | ~€20/mo | Up to ~50K logs/sec        |

CX31 covers ShortStack production volume (current: <100 logs/sec
average, peaks ~500/sec).

## docker-compose

`~/logging/docker-compose.yml`:

```yaml
version: "3.8"

services:
  clickhouse:
    image: clickhouse/clickhouse-server:24.3
    ports:
      - "127.0.0.1:8123:8123"   # HTTP — Vector + Grafana use this
      - "127.0.0.1:9000:9000"   # Native protocol — clickhouse-client
    volumes:
      - clickhouse-data:/var/lib/clickhouse
      - ./clickhouse-config.xml:/etc/clickhouse-server/config.d/custom.xml:ro
      - ./clickhouse-init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ulimits:
      nofile: { soft: 262144, hard: 262144 }
    environment:
      CLICKHOUSE_DB: logs
      CLICKHOUSE_USER: vector
      CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD}
    restart: unless-stopped

  vector:
    image: timberio/vector:0.36.0-alpine
    ports:
      - "0.0.0.0:8080:8080"   # Vercel posts here
    volumes:
      - ./vector.toml:/etc/vector/vector.toml:ro
    environment:
      CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD}
      VERCEL_LOG_DRAIN_SECRET: ${VERCEL_LOG_DRAIN_SECRET}
    depends_on: [clickhouse]
    restart: unless-stopped

  grafana:
    image: grafana/grafana:10.4.0
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
      GF_INSTALL_PLUGINS: grafana-clickhouse-datasource
    depends_on: [clickhouse]
    restart: unless-stopped

volumes:
  clickhouse-data:
  grafana-data:
```

`~/logging/.env`:

```bash
CLICKHOUSE_PASSWORD=<openssl rand -hex 24>
VERCEL_LOG_DRAIN_SECRET=<openssl rand -hex 32>
GRAFANA_ADMIN_PASSWORD=<openssl rand -hex 24>
```

## ClickHouse schema

`~/logging/clickhouse-init.sql`:

```sql
CREATE TABLE IF NOT EXISTS logs.events (
  timestamp DateTime64(3, 'UTC'),
  level LowCardinality(String),
  service LowCardinality(String) DEFAULT 'shortstack',
  env LowCardinality(String),
  release String,
  component LowCardinality(String),
  route String,
  message String,
  context String,                     -- raw JSON
  vercel_request_id String,
  vercel_deployment_id String,
  raw String CODEC(ZSTD(3))
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, component, level)
TTL timestamp + INTERVAL 90 DAY DELETE;

-- Tighter retention for very-low-value debug logs
ALTER TABLE logs.events MODIFY TTL
  timestamp + INTERVAL 90 DAY DELETE,
  timestamp + INTERVAL 14 DAY DELETE WHERE level = 'info';
```

## Vector pipeline

`~/logging/vector.toml`:

```toml
[api]
enabled = true
address = "127.0.0.1:8686"

# ── Source: Vercel log drain HTTP POSTs ────────────────────────────────
[sources.vercel_drain]
type = "http_server"
address = "0.0.0.0:8080"
encoding = "ndjson"
path = "/ingest"
strict_path = true
auth.strategy = "basic"
auth.user = "vercel"
auth.password = "${VERCEL_LOG_DRAIN_SECRET}"

# ── Transform: parse structuredLog JSON when present ───────────────────
[transforms.parse_structured]
type = "remap"
inputs = ["vercel_drain"]
source = '''
  # Vercel log drain wraps each log line with metadata:
  #   { "level": "info", "message": "...the actual line...", ... }
  # Our structuredLog emits JSON inside `message` for opted-in call sites.
  parsed, err = parse_json(.message)
  if err == null && is_object(parsed) {
    .level = string!(parsed.level || "info")
    .component = string!(parsed.component || "unknown")
    .context = encode_json(parsed.context || {})
    .timestamp = parse_timestamp(string!(parsed.timestamp), "%+") ?? now()
    .message = string!(parsed.message || .message)
    .env = string!(parsed.env || "production")
    .release = string!(parsed.release || "")
  } else {
    .level = string!(.level || "info")
    .component = "raw"
  }
  .raw = encode_json(.)
'''

# ── Sink: ClickHouse ───────────────────────────────────────────────────
[sinks.clickhouse]
type = "clickhouse"
inputs = ["parse_structured"]
endpoint = "http://clickhouse:8123"
database = "logs"
table = "events"
auth.strategy = "basic"
auth.user = "vector"
auth.password = "${CLICKHOUSE_PASSWORD}"
batch.max_events = 5000
batch.timeout_secs = 5
compression = "zstd"
skip_unknown_fields = true
```

## Wire it to Vercel

Vercel has built-in log drains:

```bash
# In the Vercel CLI, wired to your project
vercel logs --drain https://vercel:${VERCEL_LOG_DRAIN_SECRET}@logs.example.com/ingest
```

Or via the Vercel dashboard:

1. Project → Settings → Log Drains → "Add Log Drain"
2. Endpoint URL: `https://vercel:<VERCEL_LOG_DRAIN_SECRET>@logs.example.com/ingest`
3. Sources: select "All function logs" + "Build logs"
4. Format: NDJSON
5. Save.

## Caddy reverse-proxy

```caddy
logs.example.com {
  reverse_proxy 127.0.0.1:8080
  encode zstd gzip
  request_body {
    max_size 10MB
  }
}

grafana.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

## Grafana dashboards

After bringing things up, in Grafana:

1. Login as `admin` / `${GRAFANA_ADMIN_PASSWORD}`.
2. Settings → Data sources → Add → ClickHouse (Grafana official plugin).
3. Server: `http://clickhouse:8123`, user `vector`, password from `.env`.
4. Save & test.

Dashboard panels worth setting up:

| Panel                    | Query                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Errors over time         | `SELECT toStartOfMinute(timestamp) AS t, count() FROM logs.events WHERE level='error' GROUP BY t ORDER BY t`                      |
| Top noisy components     | `SELECT component, count() AS n FROM logs.events WHERE timestamp > now()-INTERVAL 1 HOUR GROUP BY component ORDER BY n DESC LIMIT 20` |
| LLM router fallbacks     | `SELECT count() FROM logs.events WHERE component='llm-router' AND message ILIKE '%falling back%'`                                  |
| Voice provider attempts  | `SELECT JSONExtractString(context, 'provider') AS p, count() FROM logs.events WHERE component='voice-router' GROUP BY p`           |
| Webhook signature fails  | `SELECT count() FROM logs.events WHERE component IN ('stripe-signature-verify','svix-signature') AND level='error'`                |

## Retention tuning

Default schema above keeps:
- `info` logs for 14 days
- `warn` + `error` for 90 days

For tighter disk usage on CX31, drop info to 7 days. ClickHouse's TTL
runs in the background — no manual cleanup.

## Query examples

```sql
-- All errors in the last hour, newest first
SELECT timestamp, component, message, context
FROM logs.events
WHERE level = 'error'
  AND timestamp > now() - INTERVAL 1 HOUR
ORDER BY timestamp DESC
LIMIT 100;

-- "Show me every email-router fallback that fired today"
SELECT timestamp, message, context
FROM logs.events
WHERE component = 'email-router'
  AND message ILIKE '%fallback%'
  AND timestamp > today();

-- Top error components over 24h
SELECT component, count() AS errors
FROM logs.events
WHERE level = 'error'
  AND timestamp > now() - INTERVAL 1 DAY
GROUP BY component
ORDER BY errors DESC
LIMIT 10;
```

## Backups

ClickHouse natively supports backups via the `BACKUP` command:

```bash
docker compose exec clickhouse clickhouse-client \
  --user vector --password "${CLICKHOUSE_PASSWORD}" \
  --query "BACKUP TABLE logs.events TO Disk('backups', '$(date +%F).zip')"
```

For 90-day retention, daily backups aren't needed — weekly is fine.
Stash to R2 with `rclone`.
