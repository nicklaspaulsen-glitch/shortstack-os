"use client";

/**
 * Admin bookings list.
 *
 * All inbound bookings on the agency calendar with filters (team, rep, date
 * range) and an inline reassign dropdown per row.
 */

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ClipboardList,
  Filter,
  Loader2,
  Users,
  CalendarDays,
  Pencil,
  X,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

interface Booking {
  id: string;
  title: string;
  client: string | null;
  team_member: string | null;
  date: string;
  time: string;
  duration: string;
  category: string;
  type: string;
  booking_status: string | null;
  booked_via: string | null;
  booking_team_id: string | null;
  booking_team_name: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  assigned_user_email: string | null;
  client_id: string | null;
  client_contact_name: string | null;
  client_contact_email: string | null;
  created_at: string;
}

interface Team {
  id: string;
  name: string;
  members: Array<{ user_id: string; name: string }>;
}

interface AgencyMember {
  id: string;
  email: string;
  full_name: string | null;
  member_profile_id: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-emerald-400/10 text-emerald-400",
  cancelled: "bg-red-400/10 text-red-400",
  rescheduled: "bg-yellow-400/10 text-yellow-400",
  no_show: "bg-orange-400/10 text-orange-400",
  completed: "bg-blue-400/10 text-blue-400",
};

export default function CalendarBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<AgencyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    team_id: "",
    rep_id: "",
    from: "",
    to: "",
  });
  const [reassigningId, setReassigningId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filters.team_id) qs.set("team_id", filters.team_id);
      if (filters.rep_id) qs.set("rep_id", filters.rep_id);
      if (filters.from) qs.set("from", filters.from);
      if (filters.to) qs.set("to", filters.to);
      const [bRes, tRes, mRes] = await Promise.all([
        fetch(`/api/calendar/bookings?${qs.toString()}`),
        fetch("/api/calendar/teams"),
        fetch("/api/team"),
      ]);
      if (bRes.ok) {
        const d = await bRes.json();
        setBookings(d.bookings || []);
      }
      if (tRes.ok) {
        const d = await tRes.json();
        setTeams(d.teams || []);
      }
      if (mRes.ok) {
        const d = await mRes.json();
        setMembers(d.members || []);
      }
    } catch {
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.team_id, filters.rep_id, filters.from, filters.to]);

  async function reassign(id: string, userId: string | null) {
    const res = await fetch("/api/calendar/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, assigned_user_id: userId }),
    });
    if (!res.ok) {
      toast.error("Failed to reassign");
      return;
    }
    toast.success("Booking reassigned");
    setReassigningId(null);
    load();
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch("/api/calendar/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, booking_status: status }),
    });
    if (!res.ok) {
      toast.error("Failed to update status");
      return;
    }
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, booking_status: status } : b)),
    );
  }

  const repOptions = useMemo(() => {
    const out: Array<{ id: string; name: string }> = [];
    for (const m of members) {
      if (m.member_profile_id) {
        out.push({ id: m.member_profile_id, name: m.full_name || m.email });
      }
    }
    return out;
  }, [members]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      <PageHero
        title="Bookings"
        subtitle="All inbound bookings across teams and reps."
        icon={<ClipboardList className="w-6 h-6" />}
        gradient="gold"
      />

      <div className="max-w-7xl mx-auto px-6 mt-6 space-y-4">
        {/* Filters */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gold" />
            <span className="text-xs uppercase tracking-wider text-white/50">
              Filters
            </span>
          </div>
          <select
            value={filters.team_id}
            onChange={(e) => setFilters({ ...filters, team_id: e.target.value })}
            className="bg-[#1a1a1a] border border-white/10 rounded px-3 py-1.5 text-sm"
          >
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={filters.rep_id}
            onChange={(e) => setFilters({ ...filters, rep_id: e.target.value })}
            className="bg-[#1a1a1a] border border-white/10 rounded px-3 py-1.5 text-sm"
          >
            <option value="">All reps</option>
            {repOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            className="bg-[#1a1a1a] border border-white/10 rounded px-3 py-1.5 text-sm"
          />
          <span className="text-white/40 text-xs">to</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            className="bg-[#1a1a1a] border border-white/10 rounded px-3 py-1.5 text-sm"
          />
          {(filters.team_id || filters.rep_id || filters.from || filters.to) && (
            <button
              onClick={() =>
                setFilters({ team_id: "", rep_id: "", from: "", to: "" })
              }
              className="ml-auto text-xs text-white/50 hover:text-white flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {/* Bookings table */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center gap-2 text-white/40 p-8">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading bookings…
            </div>
          ) : bookings.length === 0 ? (
            <div className="p-12 text-center">
              <CalendarDays className="w-12 h-12 mx-auto text-white/20 mb-3" />
              <div className="text-lg font-medium">No bookings yet</div>
              <div className="text-sm text-white/50 mt-1">
                Bookings from your portal will appear here.
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">When</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Assigned rep</th>
                  <th className="text-left px-4 py-3">Team</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr
                    key={b.id}
                    className="border-t border-white/5 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {new Date(`${b.date}T${b.time}`).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="text-xs text-white/40">
                        {b.duration} min · {b.type}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{b.client || "—"}</div>
                      {b.client_contact_name && (
                        <div className="text-xs text-white/40">
                          {b.client_contact_name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {reassigningId === b.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            autoFocus
                            defaultValue={b.assigned_user_id || ""}
                            onChange={(e) =>
                              reassign(b.id, e.target.value || null)
                            }
                            className="bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-xs"
                          >
                            <option value="">— unassigned —</option>
                            {repOptions.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => setReassigningId(null)}
                            className="text-white/40 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Users className="w-3 h-3 text-white/30" />
                          <span>{b.assigned_user_name || "Unassigned"}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {b.booking_team_name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={b.booking_status || "confirmed"}
                        onChange={(e) => updateStatus(b.id, e.target.value)}
                        className={`px-2 py-1 rounded text-xs border border-white/10 ${STATUS_COLORS[b.booking_status || "confirmed"] || "bg-white/5"}`}
                      >
                        <option value="confirmed">confirmed</option>
                        <option value="rescheduled">rescheduled</option>
                        <option value="completed">completed</option>
                        <option value="no_show">no show</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() =>
                          setReassigningId(reassigningId === b.id ? null : b.id)
                        }
                        className="text-gold text-xs hover:underline flex items-center gap-1 ml-auto"
                      >
                        <Pencil className="w-3 h-3" />
                        Reassign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
