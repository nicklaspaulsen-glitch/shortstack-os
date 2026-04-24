"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import {
  LayoutDashboard, Plus, Trash2, Loader2, Save, GripVertical,
  Users, DollarSign, TrendingUp, MessageSquare, Star, Phone, Activity,
  RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Widget definitions ─────────────────────────────────────────────────────────
const WIDGET_TYPES = [
  { id: "leads_today", label: "Leads Today", icon: <Users className="w-5 h-5" />, color: "#C9A84C", bg: "from-[#C9A84C]/15 to-[#C9A84C]/5" },
  { id: "revenue_month", label: "Revenue This Month", icon: <DollarSign className="w-5 h-5" />, color: "#10B981", bg: "from-emerald-500/15 to-emerald-500/5" },
  { id: "active_clients", label: "Active Clients", icon: <Activity className="w-5 h-5" />, color: "#3B82F6", bg: "from-blue-500/15 to-blue-500/5" },
  { id: "pipeline_value", label: "Pipeline Value", icon: <TrendingUp className="w-5 h-5" />, color: "#8B5CF6", bg: "from-violet-500/15 to-violet-500/5" },
  { id: "messages_inbox", label: "Messages Inbox", icon: <MessageSquare className="w-5 h-5" />, color: "#F59E0B", bg: "from-amber-500/15 to-amber-500/5" },
  { id: "reviews_week", label: "Reviews This Week", icon: <Star className="w-5 h-5" />, color: "#EC4899", bg: "from-pink-500/15 to-pink-500/5" },
  { id: "upcoming_calls", label: "Upcoming Calls", icon: <Phone className="w-5 h-5" />, color: "#06B6D4", bg: "from-cyan-500/15 to-cyan-500/5" },
] as const;

type WidgetId = typeof WIDGET_TYPES[number]["id"];

interface WidgetInstance {
  instanceId: string;
  widgetId: WidgetId;
}

function getWidgetDef(id: WidgetId) {
  return WIDGET_TYPES.find((w) => w.id === id)!;
}

// Placeholder metric values — in production these would be real queries
const MOCK_VALUES: Record<WidgetId, string> = {
  leads_today: "12",
  revenue_month: "$8,420",
  active_clients: "34",
  pipeline_value: "$142K",
  messages_inbox: "7 new",
  reviews_week: "9",
  upcoming_calls: "3 today",
};

function WidgetCard({
  instance,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
}: {
  instance: WidgetInstance;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
}) {
  const def = getWidgetDef(instance.widgetId);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`rounded-xl border bg-gradient-to-br ${def.bg} p-4 flex flex-col gap-3 cursor-grab active:cursor-grabbing transition-all select-none ${
        isDragOver ? "border-[#C9A84C]/60 scale-[1.02]" : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-white/20 shrink-0" />
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${def.color}20`, color: def.color }}
          >
            {def.icon}
          </div>
          <span className="text-xs font-semibold text-white/70">{def.label}</span>
        </div>
        <button
          onClick={onRemove}
          className="w-6 h-6 rounded-md flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-2xl font-bold text-white pl-6">{MOCK_VALUES[instance.widgetId]}</p>
      <p className="text-[10px] text-white/30 pl-6 uppercase tracking-wider">Live data</p>
    </div>
  );
}

export default function CustomDashboardPage() {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<WidgetInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const supabase = createClient();
  const counterRef = useRef(0);

  const makeId = () => `w_${++counterRef.current}_${Date.now()}`;

  const loadLayout = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("custom_dashboard_layouts")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (data) {
      setLayoutId(data.id);
      setWidgets((data.layout as WidgetInstance[]) ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadLayout(); }, [loadLayout]);

  const saveLayout = async (nextWidgets: WidgetInstance[]) => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = { profile_id: user.id, layout: nextWidgets, updated_at: new Date().toISOString() };
      if (layoutId) {
        await supabase.from("custom_dashboard_layouts").update(payload).eq("id", layoutId);
      } else {
        const { data } = await supabase.from("custom_dashboard_layouts").insert(payload).select().single();
        if (data) setLayoutId(data.id);
      }
      toast.success("Layout saved");
    } catch {
      toast.error("Failed to save layout");
    } finally {
      setSaving(false);
    }
  };

  const addWidget = (widgetId: WidgetId) => {
    const next = [...widgets, { instanceId: makeId(), widgetId }];
    setWidgets(next);
  };

  const removeWidget = (instanceId: string) => {
    const next = widgets.filter((w) => w.instanceId !== instanceId);
    setWidgets(next);
  };

  const resetLayout = () => {
    setWidgets([]);
    toast("Layout cleared", { icon: "🗑️" });
  };

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  };

  const handleDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const next = [...widgets];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setWidgets(next);
    setDragIdx(null);
    setOverIdx(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHero
        title="Custom Dashboard"
        subtitle="Drag widgets onto your personal dashboard — your key metrics, your layout."
        icon={<LayoutDashboard className="w-6 h-6" />}
        gradient="green"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={resetLayout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/15 text-white/70 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={() => saveLayout(widgets)}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-[#C9A84C] hover:bg-[#d4b55d] text-black transition-all disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Layout
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Widget picker sidebar */}
        <div className="lg:col-span-1 rounded-xl border border-white/8 bg-white/3 p-4 flex flex-col gap-3 h-fit">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
            Add Widgets
          </p>
          <div className="flex flex-col gap-2">
            {WIDGET_TYPES.map((wt) => (
              <button
                key={wt.id}
                onClick={() => addWidget(wt.id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/3 hover:bg-white/8 border border-white/6 hover:border-white/12 transition-all text-left"
              >
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: `${wt.color}20`, color: wt.color }}
                >
                  {wt.icon}
                </div>
                <span className="text-xs text-white/70 font-medium">{wt.label}</span>
                <Plus className="w-3.5 h-3.5 text-white/30 ml-auto shrink-0" />
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/25 text-center mt-1">
            Click to add · drag to reorder
          </p>
        </div>

        {/* Dashboard canvas */}
        <div className="lg:col-span-3">
          {widgets.length === 0 ? (
            <div
              className="rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-3 py-20 text-center"
              onDragOver={(e) => e.preventDefault()}
            >
              <LayoutDashboard className="w-10 h-10 text-white/20" />
              <p className="text-white/40 text-sm">Your dashboard is empty</p>
              <p className="text-white/25 text-xs">Add widgets from the panel on the left</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {widgets.map((w, idx) => (
                <WidgetCard
                  key={w.instanceId}
                  instance={w}
                  onRemove={() => removeWidget(w.instanceId)}
                  onDragStart={handleDragStart(idx)}
                  onDragOver={handleDragOver(idx)}
                  onDrop={handleDrop(idx)}
                  isDragOver={overIdx === idx && dragIdx !== idx}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
