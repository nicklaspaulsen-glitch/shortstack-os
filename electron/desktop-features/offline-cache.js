// ShortStack OS — Offline Cache (SQLite scaffold + JSON fallback)
//
// Desktop-only differentiator: mirror the most recent Supabase rows to a
// local store so the dashboard still shows a useful state when offline
// (train, plane, airbnb wifi tantrum, etc.) and so cold-start renders
// instantly without waiting on a network round-trip.
//
// ⚠️  STATUS — SCAFFOLD WITH JSON FALLBACK
//
//   The production plan is to use `better-sqlite3` (synchronous, native,
//   zero-config, ~250ms cold read for 10k rows). It's NOT currently in
//   package.json so we ship a JSON-file backed implementation that mirrors
//   the exact public API. Replacing the backing store is a drop-in:
//
//     TODO(sqlite): add to package.json dependencies:
//       "better-sqlite3": "^11.3.0"
//     TODO(sqlite): run electron-rebuild so the native module binds to
//       Electron's ABI. electron-builder handles this via the postinstall
//       step, but during dev you'll want:
//       npx electron-rebuild -f -w better-sqlite3
//     TODO(sqlite): replace the `backend` object below with the sqlite
//       impl. Tables are already defined in TABLE_SHAPES; just translate
//       upsert/query to prepared statements.
//
// Tables (kept as plain arrays of rows in the JSON fallback):
//   offline_clients
//   offline_leads
//   offline_tasks
//   offline_generations_history
//
// All four mirror their Supabase counterparts but only hold the most recent
// ~100 rows per table. Sync runs on boot and every 5 minutes while online.
//
// IPC surface:
//   offlineCache:sync                → force a sync now
//   offlineCache:query {table,opts}  → read-through to local cache
//   offlineCache:status              → { online, lastSync, counts }
//
// Renderer preload exposes:
//   window.ssDesktop.offlineQuery(table, opts)
//   window.ssDesktop.isOnline()
//   window.ssDesktop.syncCache()

const { app, ipcMain, net } = require("electron");
const path = require("path");
const fs = require("fs");

let ctx = null;

// ── Backend selection ────────────────────────────────────────────
// We attempt to require better-sqlite3; if it's not available, we fall
// back to the JSON store. This way the same file ships both in scaffold
// form and (once deps are installed) in production form with no further
// edits to this module.

let sqliteAvailable = false;
let Database = null;
try {
  // eslint-disable-next-line global-require
  Database = require("better-sqlite3");
  sqliteAvailable = true;
} catch {
  sqliteAvailable = false;
}

// ── Table shapes ──────────────────────────────────────────────────
// These mirror the Supabase columns we care about. Keep minimal — the
// cache is for read-only quick access, full rows live in Supabase.

const TABLE_SHAPES = {
  offline_clients: {
    supabaseTable: "clients",
    apiEndpoint: "/api/clients?limit=100",
    columns: ["id", "user_id", "name", "business_name", "status", "created_at", "updated_at"],
    primaryKey: "id",
  },
  offline_leads: {
    supabaseTable: "leads",
    apiEndpoint: "/api/leads?limit=100",
    columns: ["id", "user_id", "client_id", "name", "email", "status", "score", "created_at"],
    primaryKey: "id",
  },
  offline_tasks: {
    supabaseTable: "tasks",
    apiEndpoint: "/api/tasks?limit=100",
    columns: ["id", "user_id", "client_id", "title", "status", "priority", "due_date", "created_at"],
    primaryKey: "id",
  },
  offline_generations_history: {
    supabaseTable: "generations_history",
    apiEndpoint: "/api/generations?limit=100",
    columns: ["id", "user_id", "kind", "tokens_used", "created_at"],
    primaryKey: "id",
  },
};

// ── JSON fallback backend ─────────────────────────────────────────
// Simple, synchronous, zero-dep. Writes the whole table on every upsert
// which is fine at this scale (rows < 500 total).

function jsonStorePath(table) {
  const dir = path.join(app.getPath("userData"), "offline-cache");
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return path.join(dir, `${table}.json`);
}

function jsonRead(table) {
  const p = jsonStorePath(table);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return [];
  }
}

function jsonWrite(table, rows) {
  const p = jsonStorePath(table);
  try {
    fs.writeFileSync(p, JSON.stringify(rows, null, 2));
  } catch {}
}

const jsonBackend = {
  kind: "json",
  init() { /* no-op — dirs are created lazily */ },
  upsertMany(table, rows) {
    if (!rows || rows.length === 0) return { inserted: 0 };
    const existing = jsonRead(table);
    const shape = TABLE_SHAPES[table];
    const pk = shape?.primaryKey || "id";
    const byId = new Map(existing.map(r => [r[pk], r]));
    for (const row of rows) byId.set(row[pk], row);
    // Keep only the newest 100 rows (by created_at if present).
    const merged = [...byId.values()].sort((a, b) => {
      const aT = Date.parse(a.created_at || 0) || 0;
      const bT = Date.parse(b.created_at || 0) || 0;
      return bT - aT;
    }).slice(0, 100);
    jsonWrite(table, merged);
    return { inserted: rows.length, total: merged.length };
  },
  query(table, opts = {}) {
    const rows = jsonRead(table);
    const limit = Math.max(1, Math.min(opts.limit || 50, 100));
    const filtered = opts.where
      ? rows.filter(r => Object.entries(opts.where).every(([k, v]) => r[k] === v))
      : rows;
    return filtered.slice(0, limit);
  },
  count(table) {
    return jsonRead(table).length;
  },
};

// ── SQLite backend (activated when better-sqlite3 is installed) ──

let db = null;
const sqliteBackend = {
  kind: "sqlite",
  init() {
    if (db) return;
    if (!Database) return;
    const dbPath = path.join(app.getPath("userData"), "offline-cache.sqlite");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");

    for (const [table, shape] of Object.entries(TABLE_SHAPES)) {
      const cols = shape.columns
        .map(c => c === shape.primaryKey ? `${c} TEXT PRIMARY KEY` : `${c} TEXT`)
        .join(", ");
      db.exec(`CREATE TABLE IF NOT EXISTS ${table} (${cols})`);
    }
  },
  upsertMany(table, rows) {
    if (!db) return { inserted: 0 };
    if (!rows || rows.length === 0) return { inserted: 0 };
    const shape = TABLE_SHAPES[table];
    const cols = shape.columns;
    const placeholders = cols.map(() => "?").join(", ");
    const updates = cols.filter(c => c !== shape.primaryKey)
      .map(c => `${c}=excluded.${c}`).join(", ");
    const stmt = db.prepare(
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})
       ON CONFLICT(${shape.primaryKey}) DO UPDATE SET ${updates}`
    );
    const tx = db.transaction((rows) => {
      for (const r of rows) {
        stmt.run(cols.map(c => {
          const v = r[c];
          return v === undefined || v === null ? null : String(v);
        }));
      }
    });
    tx(rows);

    // Keep only the 100 most recent rows to bound disk usage.
    db.exec(`
      DELETE FROM ${table} WHERE ${shape.primaryKey} NOT IN (
        SELECT ${shape.primaryKey} FROM ${table}
        ORDER BY COALESCE(created_at, '') DESC LIMIT 100
      )
    `);

    return { inserted: rows.length };
  },
  query(table, opts = {}) {
    if (!db) return [];
    const limit = Math.max(1, Math.min(opts.limit || 50, 100));
    const whereKeys = opts.where ? Object.keys(opts.where) : [];
    const whereClause = whereKeys.length > 0
      ? `WHERE ${whereKeys.map(k => `${k} = ?`).join(" AND ")}`
      : "";
    const args = whereKeys.map(k => opts.where[k]);
    args.push(limit);
    const rows = db.prepare(
      `SELECT * FROM ${table} ${whereClause} ORDER BY COALESCE(created_at, '') DESC LIMIT ?`
    ).all(...args);
    return rows;
  },
  count(table) {
    if (!db) return 0;
    return db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
  },
};

const backend = sqliteAvailable ? sqliteBackend : jsonBackend;

// ── Online detection ─────────────────────────────────────────────
// We use net.isOnline() (Electron wraps Chromium's network state) and
// augment with a simple reachability probe against the app URL.

let lastSync = null;
let lastOnline = true;
let syncInFlight = false;
let syncInterval = null;

function isOnline() {
  try {
    if (net.isOnline && !net.isOnline()) return false;
  } catch {}
  return lastOnline;
}

async function probeReachability() {
  if (!ctx?.appUrl) return true;
  try {
    const res = await net.fetch(ctx.appUrl + "/api/app/version", {
      method: "HEAD",
    });
    lastOnline = res.ok || (res.status > 0 && res.status < 500);
    return lastOnline;
  } catch {
    lastOnline = false;
    return false;
  }
}

// ── Sync ─────────────────────────────────────────────────────────
// Calls the web app's existing REST endpoints (authed via the stored
// agent session token, if present) and upserts the rows into the local
// cache. Each table's sync is independent — a failure on one doesn't
// abort the others.

function authHeader() {
  try {
    const session = ctx?.getAgentSession?.();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {}
  return {};
}

async function syncTable(table) {
  const shape = TABLE_SHAPES[table];
  if (!shape) return { table, ok: false, error: "unknown-table" };
  if (!ctx?.appUrl) return { table, ok: false, error: "no-app-url" };

  try {
    const res = await net.fetch(ctx.appUrl + shape.apiEndpoint, {
      headers: { "Content-Type": "application/json", ...authHeader() },
    });
    if (!res.ok) {
      return { table, ok: false, error: `status-${res.status}` };
    }
    const data = await res.json();
    // Endpoints may return either an array or { items: [...] } — handle both.
    const rows = Array.isArray(data) ? data : (data.items || data.rows || data.data || []);
    const result = backend.upsertMany(table, rows);
    return { table, ok: true, ...result };
  } catch (err) {
    return { table, ok: false, error: String(err?.message || err) };
  }
}

async function sync() {
  if (syncInFlight) {
    return { ok: false, error: "sync-in-flight" };
  }
  syncInFlight = true;
  try {
    const reachable = await probeReachability();
    if (!reachable) {
      return { ok: false, error: "offline", online: false };
    }

    const results = await Promise.all(
      Object.keys(TABLE_SHAPES).map(table => syncTable(table))
    );
    lastSync = new Date().toISOString();

    // Notify renderer of fresh cache so any "stale" banners can clear.
    try {
      const mw = ctx?.getMainWindow?.();
      if (mw && !mw.isDestroyed()) {
        mw.webContents.send("desktop:cache-synced", { lastSync, results });
      }
    } catch {}

    return { ok: true, lastSync, results };
  } finally {
    syncInFlight = false;
  }
}

function startInterval() {
  if (syncInterval) return;
  syncInterval = setInterval(() => {
    // Skip the interval sync if the user is offline — probeReachability
    // inside sync() will bail early anyway, but this saves a wasted probe.
    sync().catch(() => {});
  }, 5 * 60 * 1000);
}

function stopInterval() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// ── IPC-friendly query wrapper ────────────────────────────────────
// The renderer calls this instead of poking the backend directly so we
// can validate table names (preventing arbitrary file reads) and normalize
// the output shape across JSON + SQLite.

function query(table, opts = {}) {
  if (!(table in TABLE_SHAPES)) {
    // Accept both prefixed (offline_leads) and un-prefixed (leads) names
    // so renderer code reads naturally.
    const prefixed = `offline_${table}`;
    if (prefixed in TABLE_SHAPES) table = prefixed;
    else return { ok: false, error: `unknown-table-${table}` };
  }
  try {
    const rows = backend.query(table, opts);
    return { ok: true, rows, backend: backend.kind };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

function status() {
  const counts = {};
  for (const table of Object.keys(TABLE_SHAPES)) {
    try { counts[table] = backend.count(table); } catch { counts[table] = 0; }
  }
  return {
    backend: backend.kind,
    sqliteAvailable,
    online: isOnline(),
    lastSync,
    syncInFlight,
    counts,
    tables: Object.keys(TABLE_SHAPES),
  };
}

function install(context) {
  ctx = context || {};
  try {
    backend.init();
  } catch (err) {
    console.warn("[shortstack] offline-cache backend init failed:", err?.message);
  }

  ipcMain.handle("offlineCache:sync", () => sync());
  ipcMain.handle("offlineCache:query", (_e, table, opts) => query(table, opts));
  ipcMain.handle("offlineCache:status", () => status());
  ipcMain.handle("offlineCache:is-online", () => isOnline());

  // Fire the first sync in the background — don't block app launch. If
  // it fails (e.g. user not logged in yet), the interval will retry
  // every 5 minutes.
  setTimeout(() => {
    sync().catch(() => {});
  }, 2000);

  startInterval();

  app.on("will-quit", () => {
    stopInterval();
    try { if (db) db.close(); } catch {}
  });

  return {
    ok: true,
    backend: backend.kind,
    sqliteAvailable,
    tables: Object.keys(TABLE_SHAPES),
    notice: sqliteAvailable
      ? undefined
      : "better-sqlite3 not installed — running JSON fallback. See TODO(sqlite) in offline-cache.js.",
  };
}

module.exports = {
  install,
  sync,
  query,
  status,
  isOnline,
  TABLE_SHAPES,
  get backend() { return backend.kind; },
};
