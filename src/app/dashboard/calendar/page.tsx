"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Calendar, Clock, Plus, Phone, Video, MapPin,
  ChevronLeft, ChevronRight, Loader, Check, X
} from "lucide-react";
import Modal from "@/components/ui/modal";
import toast from "react-hot-toast";

interface Appointment {
  id: string;
  title: string;
  client_name: string;
  client_id: string | null;
  date: string;
  time: string;
  duration: number;
  type: "call" | "video" | "in_person";
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string;
  created_at: string;
}

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00",
];

const TYPES = [
  { id: "call" as const, label: "Phone Call", icon: <Phone size={14} />, color: "text-blue-400" },
  { id: "video" as const, label: "Video Call", icon: <Video size={14} />, color: "text-purple-400" },
  { id: "in_person" as const, label: "In Person", icon: <MapPin size={14} />, color: "text-emerald-400" },
];

export default function CalendarPage() {
  useAuth();
  const supabase = createClient();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1);
    return monday;
  });
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "Discovery Call",
    client_name: "",
    client_id: "",
    date: new Date().toISOString().split("T")[0],
    time: "10:00",
    duration: 30,
    type: "video" as "call" | "video" | "in_person",
    notes: "",
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      setLoading(true);
      const [{ data: appts }, { data: cl }] = await Promise.all([
        supabase.from("trinity_log")
          .select("*")
          .eq("action_type", "appointment")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("clients").select("id, business_name").eq("is_active", true),
      ]);

      const parsed: Appointment[] = (appts || []).map(a => ({
        id: a.id,
        ...(a.result as Record<string, unknown>),
        created_at: a.created_at,
      } as Appointment));

      setAppointments(parsed);
      setClients(cl || []);
    } catch (err) {
      console.error("[Calendar] fetchData error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function createAppointment() {
    if (!form.client_name && !form.client_id) { toast.error("Select a client"); return; }
    setCreating(true);

    const clientName = form.client_id
      ? clients.find(c => c.id === form.client_id)?.business_name || form.client_name
      : form.client_name;

    await supabase.from("trinity_log").insert({
      action_type: "appointment",
      description: `${form.title} with ${clientName} on ${form.date} at ${form.time}`,
      client_id: form.client_id || null,
      status: "completed",
      result: {
        title: form.title,
        client_name: clientName,
        client_id: form.client_id || null,
        date: form.date,
        time: form.time,
        duration: form.duration,
        type: form.type,
        status: "scheduled",
        notes: form.notes,
      },
    });

    toast.success("Appointment booked!");
    setShowCreate(false);
    setForm({ title: "Discovery Call", client_name: "", client_id: "", date: new Date().toISOString().split("T")[0], time: "10:00", duration: 30, type: "video", notes: "" });
    fetchData();
    setCreating(false);
  }

  // Week navigation
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeek);
    d.setDate(currentWeek.getDate() + i);
    return d;
  });

  const prevWeek = () => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); };
  const nextWeek = () => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); };
  const today = new Date().toISOString().split("T")[0];

  if (loading) return <div className="flex items-center justify-center py-20"><Loader size={20} className="animate-spin text-gold" /></div>;

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Calendar size={18} className="text-gold" /> Calendar
          </h1>
          <p className="text-xs text-muted mt-0.5">Book appointments, manage calls, track meetings</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={12} /> Book Appointment
        </button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevWeek} className="btn-ghost p-2"><ChevronLeft size={16} /></button>
        <span className="text-sm font-semibold">
          {weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
        <button onClick={nextWeek} className="btn-ghost p-2"><ChevronRight size={16} /></button>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(day => {
          const dateStr = day.toISOString().split("T")[0];
          const dayAppts = appointments.filter(a => a.date === dateStr);
          const isToday = dateStr === today;

          return (
            <div key={dateStr} className={`rounded-xl p-3 min-h-[200px] border border-border ${isToday ? "ring-1 ring-gold/20 bg-gold/[0.04]" : "bg-surface-light"}`}>
              <div className="text-center mb-2">
                <p className="text-[10px] text-muted uppercase">{day.toLocaleDateString("en-US", { weekday: "short" })}</p>
                <p className={`text-lg font-bold ${isToday ? "text-gold" : "text-foreground"}`}>{day.getDate()}</p>
              </div>

              <div className="space-y-1.5">
                {dayAppts.map(appt => {
                  const typeConfig = TYPES.find(t => t.id === appt.type);
                  return (
                    <div key={appt.id} className="p-2 rounded-lg text-[10px] cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ background: "rgba(184,152,64,0.08)", border: "1px solid rgba(184,152,64,0.12)" }}>
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className={typeConfig?.color}>{typeConfig?.icon}</span>
                        <span className="font-semibold truncate">{appt.time}</span>
                      </div>
                      <p className="truncate font-medium">{appt.client_name}</p>
                      <p className="text-muted truncate">{appt.title}</p>
                    </div>
                  );
                })}

                {dayAppts.length === 0 && (
                  <button onClick={() => { setForm({ ...form, date: dateStr }); setShowCreate(true); }}
                    className="w-full py-3 text-[9px] text-muted/30 hover:text-muted transition-colors text-center rounded-lg border border-dashed border-white/5 hover:border-white/10">
                    + Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming appointments list */}
      <div className="card">
        <h2 className="section-header flex items-center gap-2"><Clock size={14} className="text-gold" /> Upcoming</h2>
        {appointments.filter(a => a.status === "scheduled").length === 0 ? (
          <p className="text-xs text-muted text-center py-6">No upcoming appointments</p>
        ) : (
          <div className="space-y-2">
            {appointments.filter(a => a.status === "scheduled").slice(0, 10).map(appt => {
              const typeConfig = TYPES.find(t => t.id === appt.type);
              return (
                <div key={appt.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-colors border border-border">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-surface-light ${typeConfig?.color}`}>
                    {typeConfig?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{appt.client_name}</p>
                    <p className="text-[10px] text-muted">{appt.title} · {appt.duration}min</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium">{appt.date}</p>
                    <p className="text-[10px] text-muted">{appt.time}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button className="p-1.5 rounded-md hover:bg-success/10 text-success/60 hover:text-success transition-colors" title="Complete">
                      <Check size={12} />
                    </button>
                    <button className="p-1.5 rounded-md hover:bg-danger/10 text-danger/60 hover:text-danger transition-colors" title="Cancel">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Book Appointment" size="md">
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Client</label>
            <select value={form.client_id} onChange={e => {
              setForm({ ...form, client_id: e.target.value, client_name: "" });
            }} className="input w-full text-xs">
              <option value="">Select client or type below</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
            {!form.client_id && (
              <input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })}
                className="input w-full text-xs mt-1.5" placeholder="Or type client/lead name" />
            )}
          </div>

          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Title</label>
            <select value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input w-full text-xs">
              <option value="Discovery Call">Discovery Call</option>
              <option value="Strategy Session">Strategy Session</option>
              <option value="Onboarding Call">Onboarding Call</option>
              <option value="Monthly Review">Monthly Review</option>
              <option value="Content Review">Content Review</option>
              <option value="Ad Review">Ad Review</option>
              <option value="Follow Up">Follow Up</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="input w-full text-xs" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Time</label>
              <select value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="input w-full text-xs">
                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Duration</label>
              <select value={form.duration} onChange={e => setForm({ ...form, duration: parseInt(e.target.value) })} className="input w-full text-xs">
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Type</label>
            <div className="flex gap-2">
              {TYPES.map(t => (
                <button key={t.id} onClick={() => setForm({ ...form, type: t.id })}
                  className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-lg border text-xs transition-all ${
                    form.type === t.id ? "border-gold/20 bg-gold/[0.04] text-gold" : "border-white/[0.06] text-muted"
                  }`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="input w-full h-16 text-xs" placeholder="Any prep notes, agenda items..." />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowCreate(false)} className="btn-secondary text-xs">Cancel</button>
            <button onClick={createAppointment} disabled={creating} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
              {creating ? <Loader size={12} className="animate-spin" /> : <Calendar size={12} />}
              {creating ? "Booking..." : "Book Appointment"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
