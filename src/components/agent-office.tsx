"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const AGENTS = [
  { id: "lead-engine", name: "Scout", role: "Leads", color: "#10b981", emoji: "🔍" },
  { id: "outreach", name: "Echo", role: "Outreach", color: "#3b82f6", emoji: "📨" },
  { id: "content", name: "Pixel", role: "Content", color: "#a855f7", emoji: "✨" },
  { id: "ads", name: "Blaze", role: "Ads", color: "#f59e0b", emoji: "🔥" },
  { id: "trinity", name: "Trinity", role: "Boss", color: "#c8a855", emoji: "👑" },
  { id: "analytics", name: "Lens", role: "Analytics", color: "#06b6d4", emoji: "📊" },
  { id: "reviews", name: "Star", role: "Reviews", color: "#eab308", emoji: "⭐" },
  { id: "seo", name: "Rank", role: "SEO", color: "#84cc16", emoji: "🌐" },
  { id: "invoice", name: "Ledger", role: "Billing", color: "#22c55e", emoji: "💰" },
  { id: "retention", name: "Keep", role: "Retention", color: "#f43f5e", emoji: "❤️" },
  { id: "social-media", name: "Wave", role: "Social", color: "#ec4899", emoji: "📱" },
  { id: "scheduler", name: "Clock", role: "Calendar", color: "#14b8a6", emoji: "📅" },
];

export default function AgentOffice() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [agents, setAgents] = useState(AGENTS.map((a) => ({
    ...a,
    actionsToday: 0,
    active: false,
    lastAction: "",
    bobOffset: Math.random() * Math.PI * 2,
    bobSpeed: 0.8 + Math.random() * 0.4,
    jitterX: 0,
    jitterY: 0,
  })));
  const [hovered, setHovered] = useState<string | null>(null);
  const frameRef = useRef<number>(0);
  const timeRef = useRef(0);
  const supabase = createClient();

  // Fetch real data
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    supabase.from("trinity_log")
      .select("agent, description")
      .gte("created_at", today)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const counts: Record<string, { count: number; last: string }> = {};
        (data || []).forEach(l => {
          const aid = l.agent || "";
          if (!counts[aid]) counts[aid] = { count: 0, last: "" };
          counts[aid].count++;
          if (!counts[aid].last) counts[aid].last = (l.description || "").substring(0, 25);
        });
        setAgents(prev => prev.map(a => ({
          ...a,
          actionsToday: counts[a.id]?.count || 0,
          active: (counts[a.id]?.count || 0) > 0,
          lastAction: counts[a.id]?.last || "",
        })));
      });
  }, []);

  // Animation loop for jitter
  useEffect(() => {
    function animate() {
      timeRef.current += 0.016;
      setAgents(prev => prev.map(a => ({
        ...a,
        jitterX: Math.sin(timeRef.current * 1.5 + a.bobOffset) * 2,
        jitterY: Math.sin(timeRef.current * a.bobSpeed + a.bobOffset) * 4,
      })));
      frameRef.current = requestAnimationFrame(animate);
    }
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  // Track mouse position relative to container
  function handleMouseMove(e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }

  const activeCount = agents.filter(a => a.active).length;

  return (
    <Link href="/dashboard/agent-supervisor" className="block">
      <div ref={containerRef} onMouseMove={handleMouseMove}
        className="rounded-xl overflow-hidden cursor-pointer transition-all hover:ring-1 hover:ring-gold/10 border border-border bg-surface/60"
        style={{ padding: "16px 12px 8px" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Agent Office</span>
          </div>
          <span className="text-[9px] text-muted">{activeCount}/{agents.length} active</span>
        </div>

        {/* Floating heads grid */}
        <div className="flex flex-wrap justify-center gap-x-1 gap-y-2">
          {agents.map(agent => {
            // Calculate eye direction based on mouse
            const eyeX = (mousePos.x - 0.5) * 3;
            const eyeY = (mousePos.y - 0.5) * 2;

            return (
              <div key={agent.id}
                className="relative flex flex-col items-center"
                style={{
                  transform: `translateX(${agent.jitterX}px) translateY(${agent.jitterY}px)`,
                  transition: "transform 0.1s ease-out",
                  width: 64,
                }}
                onMouseEnter={() => setHovered(agent.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* 3D Head */}
                <div className="relative" style={{ perspective: "200px" }}>
                  {/* Glow behind active agents */}
                  {agent.active && (
                    <div className="absolute inset-[-4px] rounded-full animate-pulse" style={{
                      background: `radial-gradient(circle, ${agent.color}20, transparent 70%)`,
                    }} />
                  )}

                  {/* Head sphere */}
                  <div className="w-10 h-10 rounded-full relative overflow-hidden"
                    style={{
                      background: `radial-gradient(circle at 40% 35%, ${agent.color}dd, ${agent.color}80 60%, ${agent.color}40 100%)`,
                      boxShadow: agent.active
                        ? `0 4px 20px ${agent.color}30, inset 0 -3px 6px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.15)`
                        : `inset 0 -4px 8px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.1)`,
                      transform: `rotateX(${eyeY * -3}deg) rotateY(${eyeX * 3}deg)`,
                      transformStyle: "preserve-3d",
                      opacity: agent.active ? 1 : 0.5,
                    }}>

                    {/* Highlight reflection */}
                    <div className="absolute rounded-full" style={{
                      top: "15%", left: "25%", width: "30%", height: "25%",
                      background: "rgba(255,255,255,0.25)",
                      filter: "blur(2px)",
                      borderRadius: "50%",
                    }} />

                    {/* Eyes */}
                    <div className="absolute flex gap-[6px]" style={{ top: "35%", left: "50%", transform: "translateX(-50%)" }}>
                      {/* Left eye */}
                      <div className="w-[7px] h-[7px] rounded-full bg-white relative overflow-hidden"
                        style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)" }}>
                        <div className="w-[4px] h-[4px] rounded-full bg-[#1a1a2e] absolute"
                          style={{
                            top: `${1 + eyeY * 1}px`,
                            left: `${1.5 + eyeX * 1}px`,
                            transition: "top 0.08s, left 0.08s",
                          }} />
                        {/* Pupil shine */}
                        <div className="w-[1.5px] h-[1.5px] rounded-full bg-white absolute"
                          style={{ top: "1px", left: "2px" }} />
                      </div>
                      {/* Right eye */}
                      <div className="w-[7px] h-[7px] rounded-full bg-white relative overflow-hidden"
                        style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)" }}>
                        <div className="w-[4px] h-[4px] rounded-full bg-[#1a1a2e] absolute"
                          style={{
                            top: `${1 + eyeY * 1}px`,
                            left: `${1.5 + eyeX * 1}px`,
                            transition: "top 0.08s, left 0.08s",
                          }} />
                        <div className="w-[1.5px] h-[1.5px] rounded-full bg-white absolute"
                          style={{ top: "1px", left: "2px" }} />
                      </div>
                    </div>

                    {/* Mouth — smile when active */}
                    <div className="absolute" style={{ bottom: "20%", left: "50%", transform: "translateX(-50%)" }}>
                      {agent.active ? (
                        <div style={{
                          width: 8, height: 4,
                          borderBottom: "2px solid rgba(255,255,255,0.5)",
                          borderRadius: "0 0 8px 8px",
                        }} />
                      ) : (
                        <div style={{
                          width: 5, height: 1.5,
                          background: "rgba(255,255,255,0.2)",
                          borderRadius: 4,
                        }} />
                      )}
                    </div>
                  </div>

                  {/* Status dot */}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${
                    agent.active ? "bg-green-400 border-[#0e1016]" : "bg-gray-600 border-[#0e1016]"
                  }`} style={agent.active ? { boxShadow: "0 0 6px rgba(74,222,128,0.4)" } : {}} />
                </div>

                {/* Name */}
                <span className="text-[7px] font-bold mt-1 text-center" style={{ color: agent.active ? agent.color : "rgba(255,255,255,0.25)" }}>
                  {agent.name}
                </span>

                {/* Actions count */}
                {agent.actionsToday > 0 && (
                  <span className="text-[6px] font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {agent.actionsToday} today
                  </span>
                )}

                {/* Hover tooltip */}
                {hovered === agent.id && (
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap">
                    <div className="px-2.5 py-1.5 rounded-lg text-center bg-surface border border-border" style={{
                      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    }}>
                      <p className="text-[9px] font-bold" style={{ color: agent.color }}>{agent.name} — {agent.role}</p>
                      {agent.lastAction && <p className="text-[7px] text-gray-400 truncate max-w-[120px]">{agent.lastAction}</p>}
                      <p className="text-[7px] text-gray-500">{agent.actionsToday} actions today</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Link>
  );
}
