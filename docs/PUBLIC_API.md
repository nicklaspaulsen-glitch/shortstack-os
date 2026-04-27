# ShortStack OS — Public API & Webhooks

A stable, customer-facing surface for building integrations against
ShortStack OS / Trinity. Bearer-token authenticated, predictable response
envelope, signed webhooks.

- **Base URL:** `https://app.shortstack.work/api/v1`
- **Auth:** `Authorization: Bearer ss_live_<token>`
- **Content-Type:** `application/json`

> The dashboard pages live at `/dashboard/api/keys` and
> `/dashboard/api/webhooks`. Mint a key there before using anything below.

---

## Authentication

Every request must carry a Bearer token:

```http
GET /api/v1/leads HTTP/1.1
Host: app.shortstack.work
Authorization: Bearer ss_live_3f9a08c4d1e72b0f8c5a92e1...
Content-Type: application/json
```

Tokens have the format `ss_live_<48 hex chars>`. They are shown ONCE at
creation time and stored as SHA-256 hashes server-side — there is no way
to retrieve a key after it is created. If you lose it, revoke and rotate.

### Scopes

| Scope   | Grants |
|---------|--------|
| `read`  | All `GET` endpoints |
| `write` | All endpoints (`GET`, `POST`, `PATCH`, `DELETE`) for owned resources |
| `admin` | Same as `write` (reserved for future tenant-management routes) |

A key may carry one or more scopes. `admin` implies all others.

### Rate limits

Each API key has a per-minute rate limit (default 60 req/min, configurable
1–600 at creation time). When exceeded, responses are HTTP 429 with:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
Retry-After: 17
```

---

## Response envelope

All `/api/v1/*` responses are wrapped in a stable shape:

```jsonc
// Success — single resource
{ "success": true, "data": { /* resource */ } }

// Success — paginated list
{
  "success": true,
  "data": [/* items */],
  "meta": { "total": 123, "page": 1, "limit": 50 }
}

// Failure
{ "success": false, "error": "Human-readable message", "code": "optional_code" }
```

---

## Endpoints

### `GET /api/v1/me`

Verify a token and inspect granted scopes.

```jsonc
{
  "success": true,
  "data": {
    "user_id": "...",
    "api_key_id": "...",
    "scopes": ["read", "write"],
    "rate_limit_per_minute": 60
  }
}
```

### Leads

| Method | Path | Scope |
|--------|------|-------|
| GET    | `/api/v1/leads`      | `read` |
| POST   | `/api/v1/leads`      | `write` |
| GET    | `/api/v1/leads/{id}` | `read` |
| PATCH  | `/api/v1/leads/{id}` | `write` |
| DELETE | `/api/v1/leads/{id}` | `write` |

Query params on list: `page`, `limit` (max 100), `status`.

Body for POST / PATCH:

```jsonc
{
  "business_name": "Acme Dental",
  "email": "owner@acme.com",
  "phone": "+15555550100",
  "industry": "dental",
  "city": "Austin",
  "state": "TX",
  "website": "acmedental.com",
  "status": "new",
  "source": "API",
  "notes": "Met at conference"
}
```

### Deals

| Method | Path | Scope |
|--------|------|-------|
| GET    | `/api/v1/deals`      | `read` |
| POST   | `/api/v1/deals`      | `write` |
| GET    | `/api/v1/deals/{id}` | `read` |
| PATCH  | `/api/v1/deals/{id}` | `write` |
| DELETE | `/api/v1/deals/{id}` | `write` |

Stages: `prospect | qualified | proposal_sent | negotiation | closed_won | closed_lost`.

Stage transitions emit `deal.stage_changed`, `deal.won`, and `deal.lost`
webhooks.

### Contacts

| Method | Path | Scope |
|--------|------|-------|
| GET    | `/api/v1/contacts`      | `read` |
| POST   | `/api/v1/contacts`      | `write` |
| GET    | `/api/v1/contacts/{id}` | `read` |
| PATCH  | `/api/v1/contacts/{id}` | `write` |
| DELETE | `/api/v1/contacts/{id}` | `write` |

A "contact" is the public-API friendly view of a row in the agency's
client roster. Internal billing/MRR fields are intentionally not exposed.

---

## Webhooks

Subscribe to events at `/dashboard/api/webhooks`. Each subscription has
its own signing secret (`whsec_...`). When matching events fire, we POST
JSON to your URL.

### Headers

```http
Content-Type: application/json
User-Agent: ShortStack-Webhooks/1.0
x-shortstack-signature: <hex hmac-sha256>
x-shortstack-event: lead.created
x-shortstack-delivery-id: <uuid>
```

### Payload

```jsonc
{
  "event": "lead.created",
  "delivered_at": "2026-04-27T18:14:22.119Z",
  "data": {
    "lead": {
      "id": "...",
      "business_name": "Acme Dental",
      ...
    }
  }
}
```

### Verifying signatures

The signature is HMAC-SHA256 of the raw request body using your subscription
secret. Use a constant-time comparison.

```ts
import crypto from "crypto";

function verify(rawBody: string, signatureHeader: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader, "hex"),
    Buffer.from(expected, "hex"),
  );
}
```

### Retries

Failed deliveries (network error, non-2xx response, timeout > 15s) retry
on exponential backoff: **1m → 5m → 30m → 2h → 12h → 24h**, capped at 6
attempts. After 6 attempts the delivery is marked `failed` and no further
retries occur.

### Available events

| Event | Fires when |
|-------|------------|
| `lead.created`       | A lead is created via API or UI |
| `lead.updated`       | A lead is updated via API |
| `lead.deleted`       | A lead is deleted via API |
| `deal.created`       | A deal is created |
| `deal.updated`       | A deal is updated |
| `deal.stage_changed` | A deal's stage transitions |
| `deal.won`           | A deal's stage transitions to `closed_won` |
| `deal.lost`          | A deal's stage transitions to `closed_lost` |
| `contact.created`    | A contact is created |
| `contact.updated`    | A contact is updated |
| `email.sent`         | A cold-email personalization is sent |
| `email.opened`       | (reserved — fires when Resend reports an open) |
| `email.clicked`      | (reserved) |
| `email.replied`      | (reserved) |
| `form.submitted`     | A native form receives a submission |
| `appointment.booked` | A scheduling-link appointment is booked |

---

## Error codes

| Status | Meaning |
|--------|---------|
| 400    | Validation failed — see `error` in body |
| 401    | Missing / invalid Bearer token |
| 403    | Token lacks the required scope for this route |
| 404    | Resource not found OR not owned by this token |
| 429    | Rate-limit exceeded |
| 500    | Internal error — already logged on our side |

---

## Versioning

All routes live under `/api/v1`. Breaking changes ship under `/api/v2`
with a deprecation window. Additive changes (new fields, new event types)
ship in place — keep your client tolerant of unknown fields.
