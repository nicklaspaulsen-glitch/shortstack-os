"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface AgentState {
  id: string;
  name: string;
  role: string;
  color: string;
  status: "working" | "idle" | "walking";
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  desk: { x: number; y: number };
  actionsToday: number;
  lastAction: string;
}

const OFFICE_AGENTS: Omit<AgentState, "status" | "x" | "y" | "targetX" | "targetY" | "actionsToday" | "lastAction">[] = [
  { id: "lead-engine", name: "Scout", role: "Leads", color: "#10b981", desk: { x: 80, y: 140 } },
  { id: "outreach", name: "Echo", role: "Outreach", color: "#3b82f6", desk: { x: 200, y: 100 } },
  { id: "content", name: "Pixel", role: "Content", color: "#a855f7", desk: { x: 320, y: 140 } },
  { id: "ads", name: "Blaze", role: "Ads", color: "#f59e0b", desk: { x: 440, y: 100 } },
  { id: "trinity", name: "Trinity", role: "Boss", color: "#c8a855", desk: { x: 560, y: 60 } },
  { id: "analytics", name: "Lens", role: "Analytics", color: "#06b6d4", desk: { x: 680, y: 100 } },
  { id: "reviews", name: "Star", role: "Reviews", color: "#eab308", desk: { x: 140, y: 220 } },
  { id: "seo", name: "Rank", role: "SEO", color: "#84cc16", desk: { x: 260, y: 260 } },
  { id: "invoice", name: "Ledger", role: "Billing", color: "#22c55e", desk: { x: 380, y: 220 } },
  { id: "retention", name: "Keep", role: "Retention", color: "#f43f5e", desk: { x: 500, y: 260 } },
  { id: "social-media", name: "Wave", role: "Social", color: "#ec4899", desk: { x: 620, y: 220 } },
  { id: "scheduler", name: "Clock", role: "Calendar", color: "#14b8a6", desk: { x: 740, y: 260 } },
];

export default function AgentOffice() {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const frameRef = useRef<number>(0);
  const supabase = createClient();

  // Initialize agents at their desks
  useEffect(() => {
    const initial: AgentState[] = OFFICE_AGENTS.map(a => ({
      ...a,
      status: "idle" as const,
      x: a.desk.x,
      y: a.desk.y,
      targetX: a.desk.x,
      targetY: a.desk.y,
      actionsToday: 0,
      lastAction: "Standing by",
    }));
    setAgents(initial);
    fetchAgentData(initial);
  }, []);

  async function fetchAgentData(_initial: AgentState[]) {
    const today = new Date().toISOString().split("T")[0];
    const { data: logs } = await supabase
      .from("trinity_log")
      .select("agent, description, status")
      .gte("created_at", today)
      .order("created_at", { ascending: false })
      .limit(100);

    const agentData: Record<string, { count: number; last: string; hasError: boolean }> = {};
    (logs || []).forEach(l => {
      const aid = l.agent || "unknown";
      if (!agentData[aid]) agentData[aid] = { count: 0, last: "", hasError: false };
      agentData[aid].count++;
      if (!agentData[aid].last) agentData[aid].last = l.description || "";
      if (l.status === "error") agentData[aid].hasError = true;
    });

    setAgents(prev => prev.map(a => {
      const data = agentData[a.id];
      return {
        ...a,
        actionsToday: data?.count || 0,
        lastAction: data?.last || "Standing by",
        status: data?.count ? "working" : "idle",
      };
    }));
  }

  // Animate agents — occasionally walk around, return to desk
  useEffect(() => {
    let tick = 0;
    const animate = () => {
      tick++;
      if (tick % 120 === 0) { // Every ~2 seconds
        setAgents(prev => prev.map(a => {
          // Randomly decide to walk somewhere or go back to desk
          if (a.status === "working" && Math.random() > 0.7) {
            // Walk to coffee machine or talk to another agent
            const destinations = [
              { x: 400, y: 30 }, // Coffee machine
              { x: 200, y: 300 }, // Break area
              { x: 600, y: 300 }, // Meeting area
            ];
            const dest = destinations[Math.floor(Math.random() * destinations.length)];
            return { ...a, status: "walking" as const, targetX: dest.x, targetY: dest.y };
          }
          if (a.status === "walking" && Math.random() > 0.5) {
            // Return to desk
            return { ...a, targetX: a.desk.x, targetY: a.desk.y };
          }
          // If close to target, mark as working/idle
          const dist = Math.abs(a.x - a.targetX) + Math.abs(a.y - a.targetY);
          if (dist < 5 && a.status === "walking") {
            const atDesk = Math.abs(a.x - a.desk.x) + Math.abs(a.y - a.desk.y) < 10;
            return { ...a, status: atDesk ? (a.actionsToday > 0 ? "working" : "idle") : "walking" };
          }
          return a;
        }));
      }

      // Move agents towards targets
      setAgents(prev => prev.map(a => {
        const dx = a.targetX - a.x;
        const dy = a.targetY - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 2) return { ...a, x: a.targetX, y: a.targetY };
        const speed = 1.5;
        return {
          ...a,
          x: a.x + (dx / dist) * speed,
          y: a.y + (dy / dist) * speed,
        };
      }));

      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <Link href="/dashboard/agent-supervisor" className="block">
      <div className="card overflow-hidden cursor-pointer hover:border-gold/10 transition-all" style={{ padding: 0 }}>
        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Agent Office</span>
          </div>
          <span className="text-[9px] text-muted">{agents.filter(a => a.status === "working").length}/{agents.length} working</span>
        </div>

        {/* Office scene */}
        <div className="relative w-full overflow-hidden" style={{ height: 300, background: "linear-gradient(180deg, rgba(15,18,25,0.8) 0%, rgba(11,13,18,0.9) 100%)" }}>
          {/* Floor grid */}
          <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.04 }}>
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Desks */}
          {OFFICE_AGENTS.map(a => (
            <div key={`desk-${a.id}`} className="absolute" style={{ left: a.desk.x - 18, top: a.desk.y + 12, width: 36, height: 20 }}>
              <div className="w-full h-full rounded-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>
                {/* Monitor */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-3 rounded-sm" style={{ background: `${a.color}15`, border: `1px solid ${a.color}20` }} />
              </div>
            </div>
          ))}

          {/* Coffee machine */}
          <div className="absolute" style={{ left: 388, top: 18 }}>
            <div className="w-6 h-8 rounded-sm" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.1)" }} />
            <p className="text-[6px] text-center text-muted/30 mt-0.5">Coffee</p>
          </div>

          {/* Agents */}
          {agents.map(agent => (
            <div
              key={agent.id}
              className="absolute transition-none"
              style={{ left: agent.x - 10, top: agent.y - 24, zIndex: Math.round(agent.y) }}
              onMouseEnter={() => setHoveredAgent(agent.id)}
              onMouseLeave={() => setHoveredAgent(null)}
            >
              {/* Agent body */}
              <div className="relative flex flex-col items-center">
                {/* Status glow */}
                {agent.status === "working" && (
                  <div className="absolute -inset-1 rounded-full animate-pulse" style={{ background: `${agent.color}10` }} />
                )}

                {/* Head */}
                <div className="w-5 h-5 rounded-full relative" style={{
                  background: `linear-gradient(135deg, ${agent.color}, ${agent.color}99)`,
                  boxShadow: agent.status === "working" ? `0 0 8px ${agent.color}40` : "none",
                }}>
                  {/* Eyes */}
                  <div className="absolute top-1.5 left-1 w-1 h-1 rounded-full bg-white/80" />
                  <div className="absolute top-1.5 right-1 w-1 h-1 rounded-full bg-white/80" />
                  {/* Mouth — smile when working */}
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full" style={{
                    width: agent.status === "working" ? 4 : 2,
                    height: agent.status === "working" ? 2 : 1,
                    background: "rgba(255,255,255,0.5)",
                    borderRadius: agent.status === "working" ? "0 0 4px 4px" : "999px",
                  }} />
                </div>

                {/* Body */}
                <div className="w-4 h-5 rounded-b-md -mt-0.5" style={{
                  background: `linear-gradient(180deg, ${agent.color}80, ${agent.color}40)`,
                }} />

                {/* Legs — animate when walking */}
                <div className="flex gap-0.5 -mt-px">
                  <div className={`w-1.5 h-2 rounded-b-sm ${agent.status === "walking" ? "animate-bounce" : ""}`}
                    style={{ background: `${agent.color}60`, animationDelay: "0ms", animationDuration: "400ms" }} />
                  <div className={`w-1.5 h-2 rounded-b-sm ${agent.status === "walking" ? "animate-bounce" : ""}`}
                    style={{ background: `${agent.color}60`, animationDelay: "200ms", animationDuration: "400ms" }} />
                </div>

                {/* Name tag */}
                <p className="text-[6px] font-bold mt-0.5 text-center whitespace-nowrap" style={{ color: agent.color }}>{agent.name}</p>

                {/* Working indicator */}
                {agent.status === "working" && (
                  <div className="absolute -top-2 -right-1 flex gap-px">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-0.5 rounded-full animate-pulse" style={{
                        height: `${3 + Math.sin(Date.now() / 200 + i) * 2}px`,
                        background: agent.color,
                        animationDelay: `${i * 100}ms`,
                      }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Hover tooltip */}
              {hoveredAgent === agent.id && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap">
                  <div className="rounded-lg px-2.5 py-1.5 text-center" style={{ background: "rgba(17,20,28,0.95)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p className="text-[9px] font-bold" style={{ color: agent.color }}>{agent.name} — {agent.role}</p>
                    <p className="text-[8px] text-muted">{agent.actionsToday} actions today</p>
                    <p className="text-[7px] text-muted/60 truncate max-w-[120px]">{agent.lastAction}</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Ambient particles */}
          {[...Array(8)].map((_, i) => (
            <div key={`p-${i}`} className="absolute w-1 h-1 rounded-full animate-pulse" style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
              background: "rgba(200,168,85,0.06)",
              animationDelay: `${i * 500}ms`,
              animationDuration: `${3000 + Math.random() * 2000}ms`,
            }} />
          ))}
        </div>
      </div>
    </Link>
  );
}
