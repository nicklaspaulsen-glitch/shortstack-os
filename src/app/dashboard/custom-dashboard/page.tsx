"use client";

import { useState } from "react";
import {
  LayoutGrid, Plus, X, GripVertical, Settings, Save,
  Share2, RefreshCw, Copy, Trash2, ChevronDown,
  BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon,
  Table, Activity, Users, DollarSign, TrendingUp,
  Maximize2, Crown,
  Zap, FileText, ArrowUpRight, ArrowDownRight
} from "lucide-react";

type WidgetType = "kpi" | "bar" | "line" | "pie" | "table" | "activity" | "clients" | "revenue";

interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  size: "sm" | "md" | "lg";
}

interface DashboardLayout {
  id: string;
  name: string;
  widgets: Widget[];
  isTemplate: boolean;
  lastModified: string;
  shared: boolean;
}

const WIDGET_LIBRARY: { type: WidgetType; label: string; icon: React.ReactNode; description: string }[] = [
  { type: "kpi", label: "KPI Card", icon: <TrendingUp size={14} />, description: "Single metric with trend" },
  { type: "bar", label: "Bar Chart", icon: <BarChart3 size={14} />, description: "Compare values across categories" },
  { type: "line", label: "Line Chart", icon: <LineChartIcon size={14} />, description: "Track trends over time" },
  { type: "pie", label: "Pie Chart", icon: <PieChartIcon size={14} />, description: "Show proportions" },
  { type: "table", label: "Data Table", icon: <Table size={14} />, description: "Tabular data display" },
  { type: "activity", label: "Activity Feed", icon: <Activity size={14} />, description: "Recent actions stream" },
  { type: "clients", label: "Client List", icon: <Users size={14} />, description: "Client overview cards" },
  { type: "revenue", label: "Revenue Counter", icon: <DollarSign size={14} />, description: "Live revenue tracker" },
];

const TEMPLATES: { name: string; description: string; icon: React.ReactNode; widgets: Widget[] }[] = [
  {
    name: "CEO Overview",
    description: "High-level metrics for executive review",
    icon: <Crown size={14} className="text-gold" />,
    widgets: [
      { id: "ceo-1", type: "kpi", title: "Monthly Revenue", size: "sm" },
      { id: "ceo-2", type: "kpi", title: "Active Clients", size: "sm" },
      { id: "ceo-3", type: "kpi", title: "Growth Rate", size: "sm" },
      { id: "ceo-4", type: "kpi", title: "Team Efficiency", size: "sm" },
      { id: "ceo-5", type: "line", title: "Revenue Trend", size: "lg" },
      { id: "ceo-6", type: "pie", title: "Revenue by Service", size: "md" },
      { id: "ceo-7", type: "table", title: "Top Clients", size: "md" },
    ],
  },
  {
    name: "Sales Manager",
    description: "Pipeline, deals, and outreach metrics",
    icon: <TrendingUp size={14} className="text-emerald-400" />,
    widgets: [
      { id: "sm-1", type: "kpi", title: "Deals This Month", size: "sm" },
      { id: "sm-2", type: "kpi", title: "Pipeline Value", size: "sm" },
      { id: "sm-3", type: "kpi", title: "Conversion Rate", size: "sm" },
      { id: "sm-4", type: "bar", title: "Deals by Stage", size: "lg" },
      { id: "sm-5", type: "activity", title: "Recent Deal Activity", size: "md" },
      { id: "sm-6", type: "clients", title: "Hot Leads", size: "md" },
    ],
  },
  {
    name: "Creative Director",
    description: "Content production and performance",
    icon: <Zap size={14} className="text-purple-400" />,
    widgets: [
      { id: "cd-1", type: "kpi", title: "Content Published", size: "sm" },
      { id: "cd-2", type: "kpi", title: "Engagement Rate", size: "sm" },
      { id: "cd-3", type: "bar", title: "Content by Platform", size: "md" },
      { id: "cd-4", type: "line", title: "Engagement Trend", size: "md" },
      { id: "cd-5", type: "activity", title: "Content Queue", size: "lg" },
    ],
  },
  {
    name: "Account Manager",
    description: "Client health and retention focus",
    icon: <Users size={14} className="text-blue-400" />,
    widgets: [
      { id: "am-1", type: "kpi", title: "Client Health Score", size: "sm" },
      { id: "am-2", type: "kpi", title: "Churn Risk", size: "sm" },
      { id: "am-3", type: "kpi", title: "NPS Score", size: "sm" },
      { id: "am-4", type: "clients", title: "Client Overview", size: "lg" },
      { id: "am-5", type: "bar", title: "Client Revenue", size: "md" },
      { id: "am-6", type: "activity", title: "Client Communications", size: "md" },
    ],
  },
];

const DEFAULT_DASHBOARD: DashboardLayout = {
  id: "dash-1",
  name: "My Dashboard",
  widgets: [
    { id: "w-1", type: "kpi", title: "Monthly Revenue", size: "sm" },
    { id: "w-2", type: "kpi", title: "Active Clients", size: "sm" },
    { id: "w-3", type: "kpi", title: "New Leads", size: "sm" },
    { id: "w-4", type: "kpi", title: "Tasks Completed", size: "sm" },
    { id: "w-5", type: "line", title: "Revenue Trend", size: "lg" },
    { id: "w-6", type: "bar", title: "Leads by Source", size: "md" },
    { id: "w-7", type: "activity", title: "Recent Activity", size: "md" },
  ],
  isTemplate: false,
  lastModified: "5 min ago",
  shared: false,
};

const SAVED_DASHBOARDS: DashboardLayout[] = [
  DEFAULT_DASHBOARD,
  { id: "dash-2", name: "Sales View", widgets: [], isTemplate: false, lastModified: "Yesterday", shared: true },
  { id: "dash-3", name: "Weekly Report", widgets: [], isTemplate: false, lastModified: "3 days ago", shared: false },
];

/* ── Mock widget rendering ── */
function WidgetKPI({ title }: { title: string }) {
  const values: Record<string, { value: string; trend: string; up: boolean }> = {
    "Monthly Revenue": { value: "$48,500", trend: "+12.4%", up: true },
    "Active Clients": { value: "24", trend: "+3", up: true },
    "New Leads": { value: "142", trend: "+22%", up: true },
    "Tasks Completed": { value: "87", trend: "-5%", up: false },
    "Growth Rate": { value: "18.2%", trend: "+2.1%", up: true },
    "Team Efficiency": { value: "94%", trend: "+1%", up: true },
    "Deals This Month": { value: "18", trend: "+6", up: true },
    "Pipeline Value": { value: "$124K", trend: "+$18K", up: true },
    "Conversion Rate": { value: "32%", trend: "+4%", up: true },
    "Content Published": { value: "48", trend: "+12", up: true },
    "Engagement Rate": { value: "5.2%", trend: "+0.8%", up: true },
    "Client Health Score": { value: "8.4", trend: "+0.2", up: true },
    "Churn Risk": { value: "2", trend: "-1", up: true },
    "NPS Score": { value: "72", trend: "+5", up: true },
  };
  const data = values[title] || { value: "0", trend: "0%", up: true };
  return (
    <div className="flex flex-col justify-between h-full">
      <p className="text-[10px] text-muted uppercase tracking-wider truncate">{title}</p>
      <p className="text-2xl font-bold mt-1">{data.value}</p>
      <div className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${data.up ? "text-emerald-400" : "text-red-400"}`}>
        {data.up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
        {data.trend}
      </div>
    </div>
  );
}

function WidgetBarChart() {
  const bars = [65, 40, 85, 55, 70, 45, 90];
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="flex items-end gap-1.5 h-full pt-2">
      {bars.map((h, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t bg-gold/80 transition-all hover:bg-gold" style={{ height: `${h}%` }} />
          <span className="text-[7px] text-muted">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function WidgetLineChart() {
  const points = [30, 45, 35, 60, 55, 70, 65, 80, 75, 90, 85, 95];
  const max = Math.max(...points);
  const svgPoints = points.map((p, i) => `${(i / (points.length - 1)) * 100},${100 - (p / max) * 80}`).join(" ");
  return (
    <div className="h-full flex items-center">
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#C9A84C" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,100 ${svgPoints} 100,100`} fill="url(#lineGrad)" />
        <polyline points={svgPoints} fill="none" stroke="#C9A84C" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function WidgetPieChart() {
  const segments = [
    { pct: 35, color: "#C9A84C", label: "Social" },
    { pct: 25, color: "#3b82f6", label: "Ads" },
    { pct: 20, color: "#10b981", label: "SEO" },
    { pct: 20, color: "#8b5cf6", label: "Email" },
  ];
  let offset = 0;
  return (
    <div className="flex items-center gap-4 h-full">
      <svg viewBox="0 0 36 36" className="w-20 h-20 shrink-0">
        {segments.map((seg, i) => {
          const dash = `${seg.pct} ${100 - seg.pct}`;
          const o = offset;
          offset += seg.pct;
          return <circle key={i} cx="18" cy="18" r="15.9" fill="none" stroke={seg.color} strokeWidth="3"
            strokeDasharray={dash} strokeDashoffset={-o} transform="rotate(-90 18 18)" />;
        })}
      </svg>
      <div className="space-y-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: seg.color }} />
            <span className="text-[9px] text-muted">{seg.label} ({seg.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WidgetTable() {
  const rows = [
    { name: "Apex Fitness", mrr: "$2,400", health: "92%" },
    { name: "CloudNine Media", mrr: "$1,800", health: "88%" },
    { name: "BrightSmile", mrr: "$1,500", health: "95%" },
    { name: "Urban Eats", mrr: "$1,200", health: "78%" },
  ];
  return (
    <table className="w-full text-[10px]">
      <thead><tr className="border-b border-border"><th className="text-left py-1 text-muted font-semibold">Client</th><th className="text-right py-1 text-muted font-semibold">MRR</th><th className="text-right py-1 text-muted font-semibold">Health</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border/30"><td className="py-1.5 font-medium">{r.name}</td><td className="py-1.5 text-right text-emerald-400">{r.mrr}</td><td className="py-1.5 text-right">{r.health}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function WidgetActivityFeed() {
  const items = [
    { text: "New lead: Peak Performance Gym", time: "2m" },
    { text: "Invoice #1042 paid", time: "15m" },
    { text: "Content approved for FitBrand", time: "1h" },
    { text: "Deal closed: $2,400/mo", time: "2h" },
  ];
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-surface-light">
          <Activity size={9} className="text-gold shrink-0" />
          <span className="text-[9px] flex-1 truncate">{item.text}</span>
          <span className="text-[8px] text-muted shrink-0">{item.time}</span>
        </div>
      ))}
    </div>
  );
}

function WidgetClientList() {
  const clients = [
    { name: "Apex Fitness", status: "active", avatar: "AF" },
    { name: "CloudNine", status: "active", avatar: "CN" },
    { name: "BrightSmile", status: "active", avatar: "BS" },
  ];
  return (
    <div className="space-y-1.5">
      {clients.map((c, i) => (
        <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-surface-light">
          <div className="w-6 h-6 rounded-lg bg-gold/10 flex items-center justify-center text-[8px] font-bold text-gold">{c.avatar}</div>
          <span className="text-[10px] font-medium flex-1">{c.name}</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">{c.status}</span>
        </div>
      ))}
    </div>
  );
}

function WidgetRevenue() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <p className="text-[10px] text-muted uppercase tracking-wider">Total Revenue</p>
      <p className="text-3xl font-bold text-emerald-400 mt-1">$48,500</p>
      <p className="text-[10px] text-muted mt-0.5">this month</p>
      <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-400 font-medium">
        <ArrowUpRight size={10} /> +12.4% vs last month
      </div>
    </div>
  );
}

function renderWidget(widget: Widget) {
  switch (widget.type) {
    case "kpi": return <WidgetKPI title={widget.title} />;
    case "bar": return <WidgetBarChart />;
    case "line": return <WidgetLineChart />;
    case "pie": return <WidgetPieChart />;
    case "table": return <WidgetTable />;
    case "activity": return <WidgetActivityFeed />;
    case "clients": return <WidgetClientList />;
    case "revenue": return <WidgetRevenue />;
    default: return <p className="text-[10px] text-muted">Unknown widget</p>;
  }
}

const SIZE_CLASSES: Record<string, string> = {
  sm: "col-span-1",
  md: "col-span-1 md:col-span-2",
  lg: "col-span-1 md:col-span-2 lg:col-span-3",
};

const SIZE_HEIGHT: Record<string, string> = {
  sm: "h-[140px]",
  md: "h-[200px]",
  lg: "h-[200px]",
};

export default function CustomDashboardPage() {
  const [dashboards] = useState<DashboardLayout[]>(SAVED_DASHBOARDS);
  const [activeDashboard, setActiveDashboard] = useState<string>("dash-1");
  const [widgets, setWidgets] = useState<Widget[]>(DEFAULT_DASHBOARD.widgets);
  const [showWidgetLib, setShowWidgetLib] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [dashboardName, setDashboardName] = useState("My Dashboard");
  const [showDashList, setShowDashList] = useState(false);
  const [shareEmail, setShareEmail] = useState("");

  function addWidget(type: WidgetType) {
    const lib = WIDGET_LIBRARY.find(w => w.type === type);
    const newWidget: Widget = {
      id: `w-${Date.now()}`,
      type,
      title: lib?.label || "Widget",
      size: type === "kpi" ? "sm" : "md",
    };
    setWidgets(prev => [...prev, newWidget]);
    setShowWidgetLib(false);
  }

  function removeWidget(id: string) {
    setWidgets(prev => prev.filter(w => w.id !== id));
  }

  function resizeWidget(id: string) {
    setWidgets(prev => prev.map(w => {
      if (w.id !== id) return w;
      const sizes: Widget["size"][] = ["sm", "md", "lg"];
      const idx = sizes.indexOf(w.size);
      return { ...w, size: sizes[(idx + 1) % sizes.length] };
    }));
  }

  function loadTemplate(template: typeof TEMPLATES[number]) {
    setWidgets(template.widgets);
    setDashboardName(template.name);
    setShowTemplates(false);
  }

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="page-header mb-0 flex items-center gap-2">
              <LayoutGrid size={18} className="text-gold" />
              {editMode ? (
                <input value={dashboardName} onChange={e => setDashboardName(e.target.value)}
                  className="bg-transparent border-b border-gold/30 text-base font-bold outline-none w-48" />
              ) : (
                <span>{dashboardName}</span>
              )}
            </h1>
            <p className="text-xs text-muted mt-0.5">{widgets.length} widgets &middot; Last saved 5 min ago</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Dashboard Switcher */}
          <div className="relative">
            <button onClick={() => setShowDashList(!showDashList)}
              className="btn-secondary text-[10px] flex items-center gap-1.5">
              <FileText size={10} /> Dashboards <ChevronDown size={10} />
            </button>
            {showDashList && (
              <div className="absolute right-0 mt-1 w-56 bg-surface rounded-xl border border-border shadow-elevated z-30 p-1.5">
                {dashboards.map(d => (
                  <button key={d.id} onClick={() => { setActiveDashboard(d.id); setShowDashList(false); if (d.id === "dash-1") setWidgets(DEFAULT_DASHBOARD.widgets); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
                      activeDashboard === d.id ? "bg-gold/10 text-gold" : "hover:bg-surface-light text-muted"
                    }`}>
                    <FileText size={11} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium truncate">{d.name}</p>
                      <p className="text-[8px] text-muted">{d.lastModified}</p>
                    </div>
                    {d.shared && <Share2 size={9} className="text-blue-400" />}
                  </button>
                ))}
                <div className="border-t border-border mt-1 pt-1">
                  <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[10px] text-gold hover:bg-gold/5 transition-colors">
                    <Plus size={10} /> New Dashboard
                  </button>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => setShowTemplates(true)} className="btn-secondary text-[10px] flex items-center gap-1.5">
            <Copy size={10} /> Templates
          </button>
          <button onClick={() => setEditMode(!editMode)}
            className={`text-[10px] px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              editMode ? "bg-gold/15 text-gold border border-gold/20" : "btn-secondary"
            }`}>
            <Settings size={10} /> {editMode ? "Editing" : "Edit"}
          </button>

          {/* Auto-refresh toggle */}
          <button onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg font-medium transition-all ${
              autoRefresh ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" : "btn-secondary"
            }`}>
            <RefreshCw size={10} className={autoRefresh ? "animate-spin" : ""} /> Auto-refresh
          </button>

          <button onClick={() => setShowShare(true)} className="btn-secondary text-[10px] flex items-center gap-1.5">
            <Share2 size={10} /> Share
          </button>
          <button className="btn-primary text-xs flex items-center gap-1.5">
            <Save size={12} /> Save
          </button>
        </div>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {widgets.map(widget => (
          <div key={widget.id}
            className={`card p-3 relative group transition-all ${SIZE_CLASSES[widget.size]} ${SIZE_HEIGHT[widget.size]} ${
              editMode ? "border-dashed hover:border-gold/30" : ""
            }`}>
            {/* Widget Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                {editMode && <GripVertical size={10} className="text-muted/50 cursor-grab" />}
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider truncate">{widget.title}</p>
              </div>
              {editMode && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => resizeWidget(widget.id)} className="p-1 rounded hover:bg-surface-light text-muted hover:text-foreground" title="Resize">
                    <Maximize2 size={9} />
                  </button>
                  <button onClick={() => removeWidget(widget.id)} className="p-1 rounded hover:bg-red-500/10 text-muted hover:text-red-400" title="Remove">
                    <Trash2 size={9} />
                  </button>
                </div>
              )}
            </div>
            {/* Widget Content */}
            <div className="flex-1 overflow-hidden" style={{ height: "calc(100% - 28px)" }}>
              {renderWidget(widget)}
            </div>
          </div>
        ))}

        {/* Add Widget Card */}
        {editMode && (
          <button onClick={() => setShowWidgetLib(true)}
            className="card p-3 border-dashed hover:border-gold/20 transition-all flex flex-col items-center justify-center gap-2 h-[140px]">
            <div className="w-8 h-8 rounded-xl bg-gold/10 flex items-center justify-center">
              <Plus size={14} className="text-gold" />
            </div>
            <p className="text-[10px] font-medium text-muted">Add Widget</p>
          </button>
        )}
      </div>

      {widgets.length === 0 && (
        <div className="card text-center py-16">
          <LayoutGrid size={32} className="mx-auto mb-3 text-muted/30" />
          <p className="text-sm text-muted mb-2">No widgets on this dashboard</p>
          <p className="text-[10px] text-muted mb-4">Add widgets from the library or start from a template</p>
          <div className="flex justify-center gap-2">
            <button onClick={() => setShowWidgetLib(true)} className="btn-primary text-xs flex items-center gap-1.5"><Plus size={12} /> Add Widgets</button>
            <button onClick={() => setShowTemplates(true)} className="btn-secondary text-xs flex items-center gap-1.5"><Copy size={12} /> Use Template</button>
          </div>
        </div>
      )}

      {/* ═══ WIDGET LIBRARY MODAL ═══ */}
      {showWidgetLib && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowWidgetLib(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-lg p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><LayoutGrid size={14} className="text-gold" /> Widget Library</h3>
              <button onClick={() => setShowWidgetLib(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {WIDGET_LIBRARY.map(w => (
                <button key={w.type} onClick={() => addWidget(w.type)}
                  className="card p-3 text-left hover:border-gold/20 transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold mb-2">{w.icon}</div>
                  <p className="text-xs font-semibold">{w.label}</p>
                  <p className="text-[9px] text-muted mt-0.5">{w.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TEMPLATES MODAL ═══ */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowTemplates(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-lg p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Copy size={14} className="text-gold" /> Dashboard Templates</h3>
              <button onClick={() => setShowTemplates(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-2">
              {TEMPLATES.map((tmpl, i) => (
                <button key={i} onClick={() => loadTemplate(tmpl)}
                  className="w-full card p-3 text-left hover:border-gold/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-light flex items-center justify-center shrink-0">{tmpl.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold">{tmpl.name}</p>
                      <p className="text-[9px] text-muted">{tmpl.description}</p>
                      <p className="text-[8px] text-gold mt-0.5">{tmpl.widgets.length} widgets</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SHARE MODAL ═══ */}
      {showShare && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowShare(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Share2 size={14} className="text-gold" /> Share Dashboard</h3>
              <button onClick={() => setShowShare(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Team Member Email</label>
              <input type="email" value={shareEmail} onChange={e => setShareEmail(e.target.value)}
                className="input w-full text-xs" placeholder="colleague@company.com" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Permission</label>
              <select className="input w-full text-xs">
                <option>View Only</option>
                <option>Can Edit</option>
                <option>Full Access</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowShare(false)} className="btn-secondary text-xs">Cancel</button>
              <button className="btn-primary text-xs flex items-center gap-1.5" onClick={() => setShowShare(false)}>
                <Share2 size={12} /> Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
