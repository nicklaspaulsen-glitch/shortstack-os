"use client";

/**
 * Calendar Availability editor.
 *
 * Weekly grid × time blocks. Agency owners can also pick a team member to
 * edit. Supports a timezone selector, manual blocks, and a placeholder
 * button for Google Calendar sync (behind the ENABLE_GCAL_SYNC feature
 * flag on the backend / env).
 */

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Clock,
  Plus,
  Trash2,
  Users,
  Globe,
  Shield,
  Calendar as CalendarIcon,
  ChevronDown,
  Loader2,
  X,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

interface Rule {
  id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  active: boolean;
}

interface Block {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  source: string;
}

interface TeamMemberListItem {
  id: string;
  email: string;
  full_name: string | null;
  member_profile_id: string | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

const GCAL_SYNC_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_GCAL_SYNC === "true";

export default function CalendarAvailabilityPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<TeamMemberListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({
    starts_at: "",
    ends_at: "",
    reason: "",
  });

  async function loadMembers() {
    try {
      const res = await fetch("/api/team");
      if (!res.ok) return;
      const data = await res.json();
      setMembers(data.members || []);
    } catch {
      // non-fatal
    }
  }

  async function loadRules() {
    setLoading(true);
    try {
      const qs = selectedUserId ? `?user_id=${selectedUserId}` : "";
      const [rulesRes, blocksRes] = await Promise.all([
        fetch(`/api/calendar/availability${qs}`),
        fetch(`/api/calendar/blocks${qs}`),
      ]);
      if (rulesRes.ok) {
        const d = await rulesRes.json();
        setRules(d.rules || []);
        if (d.rules?.[0]?.timezone) setTimezone(d.rules[0].timezone);
      }
      if (blocksRes.ok) {
        const d = await blocksRes.json();
        setBlocks(d.blocks || []);
      }
    } catch {
      toast.error("Failed to load availability");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    loadRules();
  }, [selectedUserId]);

  async function addRule(day: number) {
    setSaving(true);
    try {
      const res = await fetch("/api/calendar/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUserId || undefined,
          day_of_week: day,
          start_time: "09:00:00",
          end_time: "17:00:00",
          timezone,
          active: true,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to add rule");
      } else {
        const d = await res.json();
        setRules((prev) => [...prev, d.rule]);
        toast.success(`Added ${DAYS[day]} 9am–5pm`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateRule(id: string, patch: Partial<Rule>) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const res = await fetch("/api/calendar/availability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) {
      toast.error("Failed to save");
      loadRules();
    }
  }

  async function removeRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    const res = await fetch(`/api/calendar/availability?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) toast.error("Failed to delete");
  }

  async function addBlock() {
    if (!blockForm.starts_at || !blockForm.ends_at) {
      toast.error("Start and end required");
      return;
    }
    const res = await fetch("/api/calendar/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: selectedUserId || undefined,
        starts_at: new Date(blockForm.starts_at).toISOString(),
        ends_at: new Date(blockForm.ends_at).toISOString(),
        reason: blockForm.reason || "manual block",
      }),
    });
    if (!res.ok) {
      toast.error("Failed to add block");
      return;
    }
    const d = await res.json();
    setBlocks((prev) => [...prev, d.block]);
    toast.success("Block added");
    setShowBlockModal(false);
    setBlockForm({ starts_at: "", ends_at: "", reason: "" });
  }

  async function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    const res = await fetch(`/api/calendar/blocks?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) toast.error("Failed to delete");
  }

  const rulesByDay = useMemo(() => {
    const out: Record<number, Rule[]> = {};
    for (let d = 0; d < 7; d++) out[d] = [];
    for (const r of rules) {
      (out[r.day_of_week] = out[r.day_of_week] || []).push(r);
    }
    return out;
  }, [rules]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      <PageHero
        title="Calendar availability"
        subtitle="Weekly working hours, time-off blocks, and external calendar sync."
        icon={<CalendarIcon className="w-6 h-6" />}
        gradient="gold"
        actions={
          <button
            onClick={() => setShowBlockModal(true)}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium flex items-center gap-2 transition"
          >
            <Shield className="w-4 h-4" />
            Block time
          </button>
        }
      />

      <div className="max-w-6xl mx-auto px-6 mt-6 space-y-6">
        {/* User + timezone selectors */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gold" />
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">My availability</option>
              {members
                .filter((m) => !!m.member_profile_id)
                .map((m) => (
                  <option key={m.id} value={m.member_profile_id!}>
                    {m.full_name || m.email}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-gold" />
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          {GCAL_SYNC_ENABLED ? (
            <button
              onClick={() => toast("Google Calendar sync coming soon")}
              className="ml-auto px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-sm flex items-center gap-2"
            >
              <CalendarIcon className="w-4 h-4" />
              Sync Google Calendar
            </button>
          ) : (
            <div className="ml-auto text-xs text-white/40">
              Google Calendar sync: feature flag off
            </div>
          )}
        </div>

        {/* Weekly grid */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gold" />
            Weekly working hours
          </h2>
          {loading ? (
            <div className="flex items-center gap-2 text-white/40">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-2">
              {DAYS.map((day, idx) => (
                <div
                  key={day}
                  className="grid grid-cols-[80px_1fr_auto] gap-4 items-start py-2 border-b border-white/5 last:border-0"
                >
                  <div className="font-medium text-white/80 pt-2">{day}</div>
                  <div className="space-y-2">
                    {rulesByDay[idx].length === 0 && (
                      <div className="text-sm text-white/40 pt-2">Unavailable</div>
                    )}
                    {rulesByDay[idx].map((r) => (
                      <div key={r.id} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={r.start_time.slice(0, 5)}
                          onChange={(e) =>
                            updateRule(r.id, {
                              start_time: `${e.target.value}:00`,
                            })
                          }
                          className="bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-sm"
                        />
                        <span className="text-white/40">–</span>
                        <input
                          type="time"
                          value={r.end_time.slice(0, 5)}
                          onChange={(e) =>
                            updateRule(r.id, {
                              end_time: `${e.target.value}:00`,
                            })
                          }
                          className="bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-sm"
                        />
                        <label className="flex items-center gap-1 text-xs text-white/60 ml-2">
                          <input
                            type="checkbox"
                            checked={r.active}
                            onChange={(e) =>
                              updateRule(r.id, { active: e.target.checked })
                            }
                          />
                          Active
                        </label>
                        <button
                          onClick={() => removeRule(r.id)}
                          className="ml-auto text-white/40 hover:text-red-400 p-1"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    disabled={saving}
                    onClick={() => addRule(idx)}
                    className="px-3 py-1.5 rounded-lg bg-gold/10 hover:bg-gold/20 text-gold text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3" />
                    Add slot
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manual blocks */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-gold" />
              Time-off blocks
            </h2>
            <button
              onClick={() => setShowBlockModal(true)}
              className="px-3 py-1.5 rounded-lg bg-gold/10 hover:bg-gold/20 text-gold text-xs font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add block
            </button>
          </div>
          {blocks.length === 0 ? (
            <div className="text-sm text-white/40 py-6 text-center">
              No blocks scheduled.
            </div>
          ) : (
            <div className="space-y-2">
              {blocks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="text-sm">
                      {new Date(b.starts_at).toLocaleString()} →{" "}
                      {new Date(b.ends_at).toLocaleString()}
                    </div>
                    <div className="text-xs text-white/50">
                      {b.reason} ·{" "}
                      <span className="uppercase tracking-wider">
                        {b.source}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeBlock(b.id)}
                    className="text-white/40 hover:text-red-400 p-1"
                    title="Remove block"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Block modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Block time</h3>
              <button
                onClick={() => setShowBlockModal(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-white/70 mb-1 block">Start</span>
                <input
                  type="datetime-local"
                  value={blockForm.starts_at}
                  onChange={(e) =>
                    setBlockForm({ ...blockForm, starts_at: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-white/70 mb-1 block">End</span>
                <input
                  type="datetime-local"
                  value={blockForm.ends_at}
                  onChange={(e) =>
                    setBlockForm({ ...blockForm, ends_at: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-white/70 mb-1 block">Reason</span>
                <input
                  type="text"
                  value={blockForm.reason}
                  onChange={(e) =>
                    setBlockForm({ ...blockForm, reason: e.target.value })
                  }
                  placeholder="Out of office, lunch, etc."
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowBlockModal(false)}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={addBlock}
                className="px-4 py-2 rounded-lg bg-gold/20 hover:bg-gold/30 text-gold text-sm font-medium flex items-center gap-1"
              >
                <ChevronDown className="w-4 h-4 rotate-180" />
                Add block
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
