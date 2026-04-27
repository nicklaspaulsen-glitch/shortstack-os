"use client";

import { useEffect, useState } from "react";
import {
  Key,
  Copy,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Clock,
  Shield,
  Plus,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

type Scope = "read" | "write" | "admin";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes: Scope[];
  rate_limit_per_minute: number;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

const SCOPE_PILLS: Record<Scope, string> = {
  read: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  write: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
  admin: "bg-red-500/10 text-red-300 border-red-500/30",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().split("T")[0];
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScopes, setNewScopes] = useState<Scope[]>(["read"]);
  const [newRate, setNewRate] = useState(60);
  const [creating, setCreating] = useState(false);
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadKeys() {
    setLoading(true);
    try {
      const res = await fetch("/api/api-keys");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load keys");
      setKeys(json.keys ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load keys");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKeys();
  }, []);

  function toggleScope(scope: Scope) {
    setNewScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function handleCreate() {
    if (!newName.trim() || newScopes.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          scopes: newScopes,
          rate_limit_per_minute: newRate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      setJustCreatedKey(json.plaintext_key);
      setNewName("");
      setNewScopes(["read"]);
      setNewRate(60);
      setShowCreate(false);
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this key? Existing integrations will stop working immediately.")) {
      return;
    }
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Revoke failed");
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    }
  }

  function copyKey() {
    if (!justCreatedKey) return;
    navigator.clipboard.writeText(justCreatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Key size={28} />}
        title="API Keys"
        subtitle="Programmatic access to your ShortStack OS data. One key per integration; revoke any time."
        gradient="purple"
        actions={
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-white/15 text-white border border-white/25 hover:bg-white/25 transition-all flex items-center gap-1.5"
          >
            <Plus size={11} />
            New Key
          </button>
        }
      />

      {error && (
        <div className="card p-3 border-red-500/30 bg-red-500/5 text-[11px] text-red-400 flex items-center gap-2">
          <AlertTriangle size={13} />
          <span>{error}</span>
        </div>
      )}

      {justCreatedKey && (
        <div className="card p-4 border-green-500/30 bg-green-500/5">
          <div className="flex items-start gap-3">
            <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-green-400 mb-1">
                Key created — copy it now
              </p>
              <p className="text-[10px] text-muted mb-2">
                We hash and forget. You will not see this string again.
              </p>
              <div className="flex items-center gap-2 bg-black/40 rounded-lg px-3 py-2 font-mono text-[11px]">
                <span className="truncate flex-1">{justCreatedKey}</span>
                <button
                  onClick={copyKey}
                  className="text-muted hover:text-gold transition-colors flex-shrink-0"
                >
                  {copied ? (
                    <CheckCircle size={12} className="text-green-400" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={() => setJustCreatedKey(null)}
              className="text-muted hover:text-foreground text-xs flex-shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="card p-4 space-y-3 border-gold/20 bg-gold/[0.03]">
          <div className="flex items-center gap-2">
            <Key size={13} className="text-gold" />
            <h2 className="text-xs font-semibold text-gold">New API Key</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">
                Name
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Production CRM Sync"
                className="input w-full text-xs py-1.5"
              />
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">
                Scopes
              </label>
              <div className="flex gap-1.5">
                {(["read", "write", "admin"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleScope(s)}
                    className={`flex-1 text-[10px] px-2 py-1.5 rounded-lg border transition-all ${
                      newScopes.includes(s)
                        ? SCOPE_PILLS[s]
                        : "border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">
                Rate limit (req/min)
              </label>
              <input
                type="number"
                value={newRate}
                onChange={(e) => setNewRate(parseInt(e.target.value || "60") || 60)}
                min={1}
                max={600}
                className="input w-full text-xs py-1.5"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowCreate(false)}
              className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim() || newScopes.length === 0}
              className="text-[10px] px-4 py-1.5 rounded-lg bg-gold text-black font-medium hover:bg-gold/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? "Creating…" : "Create Key"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1">
            <Key size={12} className="text-gold" />
            <p className="text-[9px] text-muted uppercase tracking-wider">Total</p>
          </div>
          <p className="text-lg font-bold text-gold">{keys.length}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={12} className="text-green-400" />
            <p className="text-[9px] text-muted uppercase tracking-wider">Active</p>
          </div>
          <p className="text-lg font-bold text-green-400">{activeKeys.length}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={12} className="text-red-400" />
            <p className="text-[9px] text-muted uppercase tracking-wider">Revoked</p>
          </div>
          <p className="text-lg font-bold text-red-400">{revokedKeys.length}</p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border text-[9px] text-muted uppercase tracking-wider bg-surface-light/40">
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Prefix</div>
          <div className="col-span-2">Scopes</div>
          <div>Rate/min</div>
          <div className="col-span-2">Last used</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-[11px] text-muted">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Key size={22} className="mx-auto mb-2 text-muted opacity-40" />
            <p className="text-[11px] text-muted">No API keys yet. Create one to get started.</p>
          </div>
        ) : (
          keys.map((k) => (
            <div
              key={k.id}
              className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-border last:border-0 text-[11px] items-center ${
                k.revoked_at ? "opacity-50" : ""
              }`}
            >
              <div className="col-span-3">
                <div className="font-medium truncate">{k.name}</div>
                <div className="text-[9px] text-muted">
                  Created {formatDate(k.created_at)}
                </div>
              </div>
              <div className="col-span-2 font-mono text-[10px] text-muted truncate">
                {k.key_prefix}…
              </div>
              <div className="col-span-2 flex flex-wrap gap-1">
                {k.scopes.map((s) => (
                  <span
                    key={s}
                    className={`text-[9px] px-1.5 py-0.5 rounded border ${SCOPE_PILLS[s]}`}
                  >
                    {s}
                  </span>
                ))}
              </div>
              <div className="text-[10px] text-muted">{k.rate_limit_per_minute}</div>
              <div className="col-span-2 text-[10px] text-muted flex items-center gap-1">
                <Clock size={9} />
                {timeAgo(k.last_used_at)}
              </div>
              <div className="col-span-2 flex items-center justify-end gap-1.5">
                {k.revoked_at ? (
                  <span className="text-[9px] text-red-400 px-2 py-1 rounded border border-red-500/20">
                    Revoked
                  </span>
                ) : (
                  <button
                    onClick={() => handleRevoke(k.id)}
                    className="text-[9px] px-2 py-1 rounded border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-1"
                  >
                    <Trash2 size={9} />
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={12} className="text-gold" />
          <h3 className="text-xs font-semibold">Using your key</h3>
        </div>
        <pre className="bg-black/40 rounded-lg p-3 text-[10px] font-mono text-green-300 overflow-x-auto">
{`curl https://app.shortstack.work/api/v1/leads \\
  -H "Authorization: Bearer ss_live_your_key_here"`}
        </pre>
        <p className="text-[10px] text-muted mt-2">
          Full reference at <code className="text-gold">/docs/PUBLIC_API.md</code>.
        </p>
      </div>
    </div>
  );
}
