"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Calendar, Clock, Users, Link2, Loader, RefreshCw,
  ExternalLink, XCircle, Copy, Video
} from "lucide-react";
import toast from "react-hot-toast";

interface EventType {
  uri: string;
  name: string;
  slug: string;
  duration: number;
  description: string;
  color: string;
  scheduling_url: string;
  active: boolean;
}

interface ScheduledEvent {
  uri: string;
  name: string;
  status: string;
  start_time: string;
  end_time: string;
  location: { type: string; location?: string; join_url?: string } | null;
  invitees_counter: { total: number; active: number; limit: number };
  created_at: string;
}

interface CalendlyUser {
  name: string;
  email: string;
  scheduling_url: string;
  timezone: string;
}

export default function SchedulingPage() {
  useAuth();
  const [user, setUser] = useState<CalendlyUser | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "event_types">("upcoming");
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [meRes, typesRes, eventsRes] = await Promise.all([
        fetch("/api/integrations/calendly?action=me"),
        fetch("/api/integrations/calendly?action=event_types"),
        fetch("/api/integrations/calendly?action=scheduled_events"),
      ]);

      const meData = await meRes.json();
      const typesData = await typesRes.json();
      const eventsData = await eventsRes.json();

      if (meData.connected === false) {
        setConnected(false);
      } else {
        setUser(meData.user || null);
        setEventTypes(typesData.event_types || []);
        setEvents(eventsData.events || []);
      }
    } catch {
      setConnected(false);
    }
    setLoading(false);
  }

  async function cancelEvent(eventUri: string) {
    setCancelling(eventUri);
    try {
      const res = await fetch("/api/integrations/calendly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_event", event_uri: eventUri }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Event cancelled");
        fetchData();
      } else {
        toast.error(data.error || "Failed");
      }
    } catch { toast.error("Error"); }
    setCancelling(null);
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  }

  if (!connected && !loading) {
    return (
      <div className="fade-in space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#006BFF]/10 rounded-xl flex items-center justify-center">
            <Calendar size={20} className="text-[#006BFF]" />
          </div>
          <div>
            <h1 className="page-header mb-0">Scheduling</h1>
            <p className="text-xs text-muted">Manage meetings via Calendly</p>
          </div>
        </div>
        <div className="card p-8 text-center">
          <Calendar size={32} className="text-muted/30 mx-auto mb-3" />
          <h2 className="text-sm font-semibold mb-1">Calendly Not Connected</h2>
          <p className="text-xs text-muted mb-3">Add your Calendly API token to environment variables:</p>
          <code className="text-[10px] bg-surface-light rounded-lg p-3 block text-muted">CALENDLY_API_TOKEN</code>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#006BFF]/10 rounded-xl flex items-center justify-center">
            <Calendar size={20} className="text-[#006BFF]" />
          </div>
          <div>
            <h1 className="page-header mb-0">Scheduling</h1>
            <p className="text-xs text-muted">
              {user ? `${user.name} — ${user.timezone}` : "Manage meetings via Calendly"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user?.scheduling_url && (
            <button onClick={() => copyLink(user.scheduling_url)}
              className="btn-secondary text-xs flex items-center gap-1.5">
              <Copy size={12} /> Copy Booking Link
            </button>
          )}
          <button onClick={fetchData} className="btn-secondary text-xs flex items-center gap-1.5">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{events.filter(e => e.status === "active").length}</p>
          <p className="text-[10px] text-muted">Upcoming</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{eventTypes.length}</p>
          <p className="text-[10px] text-muted">Event Types</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{events.reduce((s, e) => s + (e.invitees_counter?.active || 0), 0)}</p>
          <p className="text-[10px] text-muted">Total Invitees</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {([
          { id: "upcoming", label: "Upcoming Events", icon: <Clock size={13} /> },
          { id: "event_types", label: "Event Types", icon: <Link2 size={13} /> },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
              tab === t.id ? "bg-[#006BFF]/10 text-[#006BFF] font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader size={20} className="animate-spin text-[#006BFF]" /></div>
      ) : (
        <>
          {/* Upcoming Events */}
          {tab === "upcoming" && (
            <div className="space-y-2">
              {events.filter(e => e.status === "active").length === 0 ? (
                <div className="card p-8 text-center text-muted text-sm">No upcoming events</div>
              ) : (
                events.filter(e => e.status === "active").map((event, i) => {
                  const start = new Date(event.start_time);
                  const end = new Date(event.end_time);
                  const duration = Math.round((end.getTime() - start.getTime()) / 60000);
                  const isToday = start.toDateString() === new Date().toDateString();

                  return (
                    <div key={i} className={`card p-4 ${isToday ? "border-[#006BFF]/20 bg-[#006BFF]/[0.02]" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-center shrink-0">
                            <p className="text-[9px] text-muted uppercase">{start.toLocaleDateString("en-US", { month: "short" })}</p>
                            <p className="text-lg font-bold leading-none">{start.getDate()}</p>
                            <p className="text-[9px] text-muted">{start.toLocaleDateString("en-US", { weekday: "short" })}</p>
                          </div>
                          <div className="border-l border-border pl-3">
                            <p className="text-xs font-medium">{event.name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted mt-0.5">
                              <span className="flex items-center gap-0.5"><Clock size={9} /> {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} — {duration}min</span>
                              <span className="flex items-center gap-0.5"><Users size={9} /> {event.invitees_counter?.active || 0} invitee{(event.invitees_counter?.active || 0) !== 1 ? "s" : ""}</span>
                              {isToday && <span className="text-[#006BFF] font-medium">Today</span>}
                            </div>
                            {event.location?.join_url && (
                              <a href={event.location.join_url} target="_blank" rel="noopener"
                                className="flex items-center gap-1 text-[10px] text-[#006BFF] mt-1 hover:underline">
                                <Video size={10} /> Join meeting
                              </a>
                            )}
                          </div>
                        </div>
                        <button onClick={() => cancelEvent(event.uri)}
                          disabled={cancelling === event.uri}
                          className="btn-ghost text-[10px] text-muted hover:text-danger flex items-center gap-1">
                          {cancelling === event.uri ? <Loader size={10} className="animate-spin" /> : <XCircle size={10} />}
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Event Types */}
          {tab === "event_types" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {eventTypes.map((et, i) => (
                <div key={i} className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: et.color || "#006BFF" }} />
                    <p className="text-xs font-semibold flex-1">{et.name}</p>
                    <span className="text-[10px] text-muted">{et.duration} min</span>
                  </div>
                  {et.description && <p className="text-[10px] text-muted mb-2">{et.description}</p>}
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyLink(et.scheduling_url)}
                      className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1">
                      <Copy size={10} /> Copy Link
                    </button>
                    <a href={et.scheduling_url} target="_blank" rel="noopener"
                      className="btn-ghost text-[10px] px-2 py-1 flex items-center gap-1 text-muted hover:text-foreground">
                      <ExternalLink size={10} /> Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
