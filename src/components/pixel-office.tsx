"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: "working" | "idle" | "error" | "talking";
  x: number;
  y: number;
  color: string;
  headColor: string;
  message: string;
  frame: number;
  lastAction: string;
}

interface LogEntry {
  agent: string;
  color: string;
  action: string;
  time: string;
}

const AGENT_CONFIGS = [
  { id: "lead_gen", name: "Scout", role: "Lead Finder", color: "#C9A84C", headColor: "#f5e6c8", message: "Scraping Google Maps..." },
  { id: "outreach", name: "Echo", role: "Outreach Agent", color: "#38bdf8", headColor: "#bae6fd", message: "Sending cold DMs..." },
  { id: "content", name: "Pixel", role: "Content Writer", color: "#f43f5e", headColor: "#fecdd3", message: "Writing viral script..." },
  { id: "social", name: "Wave", role: "Social Manager", color: "#10b981", headColor: "#a7f3d0", message: "Scheduling posts..." },
  { id: "ads", name: "Blaze", role: "Ads Manager", color: "#f59e0b", headColor: "#fde68a", message: "Optimizing ROAS..." },
  { id: "automation", name: "Nexus", role: "Supervisor", color: "#ec4899", headColor: "#fbcfe8", message: "Monitoring agents..." },
  { id: "custom", name: "Trinity", role: "AI Assistant", color: "#8b5cf6", headColor: "#ddd6fe", message: "Ready to help..." },
  { id: "ai_receptionist", name: "Ring", role: "Cold Caller", color: "#14b8a6", headColor: "#99f6e4", message: "Dialing leads..." },
];

export default function PixelOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const frameRef = useRef(0);
  const supabase = createClient();

  // Fetch real agent activity
  useEffect(() => {
    async function fetchActivity() {
      const { data } = await supabase
        .from("trinity_log")
        .select("action_type, description, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        const newLogs: LogEntry[] = data.map(d => {
          const agent = AGENT_CONFIGS.find(a => a.id === d.action_type) || AGENT_CONFIGS[6];
          return { agent: agent.name, color: agent.color, action: d.description, time: formatRelativeTime(d.created_at) };
        });
        setLogs(newLogs);

        // Update agent statuses based on recent activity
        const activeTypes = new Set(data.filter(d => d.status === "completed").slice(0, 5).map(d => d.action_type));
        setAgents(prev => prev.map(a => ({
          ...a,
          status: activeTypes.has(a.id) ? "working" : (Math.random() > 0.4 ? "working" : "idle"),
          lastAction: data.find(d => d.action_type === a.id)?.description || a.message,
        })));
      }
    }
    fetchActivity();
    const interval = setInterval(fetchActivity, 20000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize agents
  useEffect(() => {
    const deskPositions = [
      { x: 100, y: 115 }, { x: 220, y: 115 }, { x: 340, y: 115 }, { x: 460, y: 115 },
      { x: 160, y: 235 }, { x: 280, y: 235 }, { x: 400, y: 235 }, { x: 520, y: 235 },
    ];
    setAgents(AGENT_CONFIGS.map((a, i) => ({
      ...a,
      x: deskPositions[i].x,
      y: deskPositions[i].y,
      status: Math.random() > 0.3 ? "working" : "idle",
      frame: Math.floor(Math.random() * 100),
      lastAction: a.message,
    })));
  }, []);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || agents.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const W = canvas.width;
    const H = canvas.height;

    function draw() {
      if (!ctx) return;
      frameRef.current++;
      const f = frameRef.current;

      // === BACKGROUND ===
      // Dark office floor
      ctx.fillStyle = "#080c14";
      ctx.fillRect(0, 0, W, H);

      // Floor tiles
      for (let x = 0; x < W; x += 40) {
        for (let y = 60; y < H; y += 40) {
          ctx.fillStyle = (Math.floor(x / 40) + Math.floor(y / 40)) % 2 === 0 ? "#0a1018" : "#0c1220";
          ctx.fillRect(x, y, 40, 40);
        }
      }

      // Wall
      ctx.fillStyle = "#101828";
      ctx.fillRect(0, 0, W, 65);
      ctx.fillStyle = "#1a2540";
      ctx.fillRect(0, 60, W, 5);

      // Wall decorations — windows
      for (let wx = 60; wx < W; wx += 160) {
        // Window frame
        ctx.fillStyle = "#0c1628";
        ctx.fillRect(wx, 10, 80, 40);
        // Window glass with slight glow
        const glowIntensity = Math.sin(f * 0.02 + wx) * 0.03 + 0.05;
        ctx.fillStyle = `rgba(56,189,248,${glowIntensity})`;
        ctx.fillRect(wx + 3, 13, 74, 34);
        // Window divider
        ctx.fillStyle = "#1a2540";
        ctx.fillRect(wx + 39, 10, 2, 40);
        ctx.fillRect(wx, 28, 80, 2);
      }

      // === HEADER BAR ===
      ctx.fillStyle = "rgba(6,8,12,0.85)";
      ctx.fillRect(0, 0, W, 22);
      ctx.fillStyle = "#C9A84C";
      ctx.font = "bold 10px 'Courier New', monospace";
      ctx.fillText("SHORTSTACK HQ", 10, 15);
      const working = agents.filter(a => a.status === "working").length;
      ctx.fillStyle = working === agents.length ? "#10b981" : "#64748b";
      ctx.font = "9px 'Courier New', monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${working}/${agents.length} agents active`, W - 10, 15);
      ctx.textAlign = "left";

      // === DRAW AGENTS & DESKS ===
      agents.forEach(agent => {
        const ax = agent.x;
        const ay = agent.y;
        const isWorking = agent.status === "working";
        const isHovered = hoveredAgent === agent.id;
        const bounce = isWorking ? Math.sin(f * 0.08 + agent.frame) * 2 : 0;

        // === DESK ===
        // Desk surface
        ctx.fillStyle = "#1e2a3a";
        ctx.fillRect(ax - 28, ay + 14, 56, 6);
        // Desk legs
        ctx.fillStyle = "#152030";
        ctx.fillRect(ax - 26, ay + 20, 4, 12);
        ctx.fillRect(ax + 22, ay + 20, 4, 12);
        // Desk front panel
        ctx.fillStyle = "#182438";
        ctx.fillRect(ax - 28, ay + 20, 56, 2);

        // === MONITOR ===
        // Monitor stand
        ctx.fillStyle = "#2a3a50";
        ctx.fillRect(ax - 2, ay + 6, 4, 8);
        // Monitor body
        ctx.fillStyle = "#0c1420";
        ctx.fillRect(ax - 14, ay - 8, 28, 16);
        // Monitor bezel
        ctx.strokeStyle = "#2a3a50";
        ctx.lineWidth = 1;
        ctx.strokeRect(ax - 14, ay - 8, 28, 16);

        // Screen content
        if (isWorking) {
          ctx.fillStyle = agent.color + "15";
          ctx.fillRect(ax - 12, ay - 6, 24, 12);
          // Code lines
          for (let line = 0; line < 4; line++) {
            const lineWidth = 6 + Math.sin(f * 0.1 + line + agent.frame) * 4;
            ctx.fillStyle = agent.color + "40";
            ctx.fillRect(ax - 10, ay - 4 + line * 3, lineWidth, 1.5);
          }
          // Cursor blink
          if (f % 30 < 15) {
            ctx.fillStyle = agent.color;
            ctx.fillRect(ax - 10 + (f % 20), ay - 4 + (f % 4) * 3, 1, 2);
          }
        } else {
          ctx.fillStyle = "#0a1018";
          ctx.fillRect(ax - 12, ay - 6, 24, 12);
          // Screensaver dot
          const dotX = ax - 8 + Math.sin(f * 0.03 + agent.frame) * 6;
          const dotY = ay - 2 + Math.cos(f * 0.04 + agent.frame) * 3;
          ctx.fillStyle = agent.color + "30";
          ctx.beginPath();
          ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // === KEYBOARD ===
        ctx.fillStyle = "#1a2838";
        ctx.fillRect(ax - 10, ay + 10, 20, 4);

        // === COFFEE CUP ===
        ctx.fillStyle = "#2a3a50";
        ctx.fillRect(ax + 18, ay + 8, 6, 6);
        ctx.fillStyle = "#8b5cf620";
        ctx.fillRect(ax + 19, ay + 9, 4, 3);

        // === CHARACTER ===
        const cy = ay + bounce;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(ax, ay + 13, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Chair
        ctx.fillStyle = "#1a2535";
        ctx.fillRect(ax - 8, ay + 2, 16, 10);
        ctx.fillStyle = "#1e2a3a";
        ctx.fillRect(ax - 6, ay - 4, 12, 18);

        // Body (torso)
        ctx.fillStyle = agent.color;
        ctx.fillRect(ax - 5, cy - 4, 10, 12);

        // Arms
        if (isWorking) {
          // Typing animation — arms move
          const armOffset = Math.sin(f * 0.15 + agent.frame) * 2;
          ctx.fillStyle = agent.color;
          ctx.fillRect(ax - 8, cy + 1, 3, 6);
          ctx.fillRect(ax + 5, cy + 1, 3, 6);
          // Hands on keyboard
          ctx.fillStyle = agent.headColor;
          ctx.fillRect(ax - 8 + armOffset, cy + 7, 3, 2);
          ctx.fillRect(ax + 5 - armOffset, cy + 7, 3, 2);
        } else {
          ctx.fillStyle = agent.color;
          ctx.fillRect(ax - 7, cy + 1, 3, 8);
          ctx.fillRect(ax + 4, cy + 1, 3, 8);
        }

        // Head
        ctx.fillStyle = agent.headColor;
        ctx.fillRect(ax - 4, cy - 10, 8, 8);

        // Hair
        ctx.fillStyle = agent.color + "80";
        ctx.fillRect(ax - 4, cy - 11, 8, 3);

        // Eyes
        const blink = f % 150 < 4;
        if (!blink) {
          ctx.fillStyle = "#1a1a2e";
          ctx.fillRect(ax - 3, cy - 7, 2, 2);
          ctx.fillRect(ax + 1, cy - 7, 2, 2);
          // Pupils — look at monitor
          ctx.fillStyle = "#000";
          ctx.fillRect(ax - 2, cy - 7, 1, 1);
          ctx.fillRect(ax + 2, cy - 7, 1, 1);
        } else {
          ctx.fillStyle = "#1a1a2e";
          ctx.fillRect(ax - 3, cy - 6, 2, 1);
          ctx.fillRect(ax + 1, cy - 6, 2, 1);
        }

        // Mouth
        if (agent.status === "talking" && f % 20 < 10) {
          ctx.fillStyle = "#1a1a2e";
          ctx.fillRect(ax - 1, cy - 4, 2, 1);
        }

        // Status indicator — floating dot
        const statusColor = agent.status === "working" ? "#10b981" : agent.status === "error" ? "#f43f5e" : agent.status === "talking" ? "#C9A84C" : "#475569";
        ctx.fillStyle = statusColor;
        ctx.beginPath();
        ctx.arc(ax + 6, cy - 12, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Glow
        ctx.fillStyle = statusColor + "40";
        ctx.beginPath();
        ctx.arc(ax + 6, cy - 12, 4, 0, Math.PI * 2);
        ctx.fill();

        // Speech bubble on hover
        if (isHovered) {
          const text = agent.lastAction || agent.message;
          const bubbleW = Math.min(text.length * 4.5 + 16, 180);
          const bubbleX = Math.max(5, Math.min(ax - bubbleW / 2, W - bubbleW - 5));
          const bubbleY = cy - 30;

          // Bubble bg
          ctx.fillStyle = "rgba(12,16,23,0.95)";
          ctx.strokeStyle = agent.color + "50";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(bubbleX, bubbleY, bubbleW, 18, 4);
          ctx.fill();
          ctx.stroke();

          // Arrow
          ctx.fillStyle = "rgba(12,16,23,0.95)";
          ctx.beginPath();
          ctx.moveTo(ax - 4, bubbleY + 18);
          ctx.lineTo(ax + 4, bubbleY + 18);
          ctx.lineTo(ax, bubbleY + 23);
          ctx.fill();

          // Name + role
          ctx.fillStyle = agent.color;
          ctx.font = "bold 7px 'Courier New', monospace";
          ctx.fillText(agent.name, bubbleX + 6, bubbleY + 9);

          // Action text
          ctx.fillStyle = "#94a3b8";
          ctx.font = "6px 'Courier New', monospace";
          const trimmed = text.length > 35 ? text.substring(0, 35) + "..." : text;
          ctx.fillText(trimmed, bubbleX + 6, bubbleY + 15);
        }

        // Name label
        ctx.fillStyle = "#475569";
        ctx.font = "7px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText(agent.name, ax, ay + 40);
        ctx.textAlign = "left";
      });

      // Random status flicker
      if (f % 240 === 0) {
        setAgents(prev => prev.map(a => {
          if (Math.random() > 0.8) {
            const s: Agent["status"][] = ["working", "idle", "working", "working", "talking"];
            return { ...a, status: s[Math.floor(Math.random() * s.length)] };
          }
          return a;
        }));
      }

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animId);
  }, [agents, hoveredAgent]);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    let found: string | null = null;
    for (const agent of agents) {
      if (Math.abs(x - agent.x) < 20 && Math.abs(y - agent.y) < 20) {
        found = agent.id;
        break;
      }
    }
    setHoveredAgent(found);
  }

  return (
    <div className="space-y-2">
      <div className="rounded-2xl overflow-hidden border border-border/30 bg-[#080c14]">
        <canvas
          ref={canvasRef}
          width={620}
          height={300}
          className="w-full cursor-pointer"
          style={{ imageRendering: "pixelated" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredAgent(null)}
        />
      </div>

      {/* Live Activity Log */}
      {logs.length > 0 && (
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[9px] text-muted uppercase tracking-[0.15em] font-bold flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              HQ Activity Log
            </h3>
            <span className="text-[7px] text-muted/40">Live</span>
          </div>
          <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
            {logs.slice(0, 8).map((log, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <div className="w-1 h-1 rounded-full shrink-0" style={{ background: log.color }} />
                <span className="text-[8px] font-bold shrink-0" style={{ color: log.color }}>{log.agent}</span>
                <span className="text-[8px] text-muted/60 truncate flex-1">{log.action}</span>
                <span className="text-[7px] text-muted/30 shrink-0">{log.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
