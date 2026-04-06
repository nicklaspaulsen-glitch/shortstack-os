"use client";

import { useEffect, useRef, useState } from "react";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: "working" | "idle" | "error" | "talking";
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  deskX: number;
  deskY: number;
  color: string;
  message: string;
  frame: number;
}

const AGENTS_CONFIG: Omit<Agent, "x" | "y" | "targetX" | "targetY" | "frame">[] = [
  { id: "lead-gen", name: "Scout", role: "Lead Finder", status: "working", deskX: 60, deskY: 80, color: "#C9A84C", message: "Scraping leads..." },
  { id: "outreach", name: "Echo", role: "Outreach", status: "working", deskX: 160, deskY: 80, color: "#38bdf8", message: "Sending DMs..." },
  { id: "content", name: "Pixel", role: "Content AI", status: "working", deskX: 260, deskY: 80, color: "#f43f5e", message: "Writing scripts..." },
  { id: "social", name: "Wave", role: "Social Manager", status: "idle", deskX: 360, deskY: 80, color: "#10b981", message: "Scheduling posts..." },
  { id: "ads", name: "Blaze", role: "Ads Manager", status: "working", deskX: 460, deskY: 80, color: "#f59e0b", message: "Optimizing ROAS..." },
  { id: "trinity", name: "Trinity", role: "AI Assistant", status: "talking", deskX: 260, deskY: 170, color: "#8b5cf6", message: "Ready to help!" },
  { id: "supervisor", name: "Nexus", role: "Supervisor", status: "working", deskX: 160, deskY: 170, color: "#ec4899", message: "Monitoring agents..." },
  { id: "calls", name: "Ring", role: "Cold Caller", status: "idle", deskX: 360, deskY: 170, color: "#14b8a6", message: "Dialing leads..." },
];

export default function PixelOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    setAgents(AGENTS_CONFIG.map(a => ({
      ...a,
      x: a.deskX,
      y: a.deskY,
      targetX: a.deskX,
      targetY: a.deskY,
      frame: Math.floor(Math.random() * 60),
    })));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    function draw() {
      if (!ctx || !canvas) return;
      const w = canvas.width;
      const h = canvas.height;
      frameRef.current++;

      // Background — dark office floor
      ctx.fillStyle = "#0a0e14";
      ctx.fillRect(0, 0, w, h);

      // Grid floor
      ctx.strokeStyle = "#111820";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Draw desks
      agents.forEach(agent => {
        // Desk
        ctx.fillStyle = "#1a2030";
        ctx.fillRect(agent.deskX - 18, agent.deskY + 12, 36, 16);
        ctx.strokeStyle = "#2a3040";
        ctx.strokeRect(agent.deskX - 18, agent.deskY + 12, 36, 16);

        // Monitor on desk
        ctx.fillStyle = agent.status === "working" ? "#0c1017" : "#0a0e14";
        ctx.fillRect(agent.deskX - 8, agent.deskY + 4, 16, 10);
        if (agent.status === "working") {
          ctx.fillStyle = agent.color + "40";
          ctx.fillRect(agent.deskX - 6, agent.deskY + 6, 12, 6);
          // Screen flicker
          if (frameRef.current % 10 < 5) {
            ctx.fillStyle = agent.color + "20";
            ctx.fillRect(agent.deskX - 6, agent.deskY + 6 + (frameRef.current % 3) * 2, 12, 2);
          }
        }
      });

      // Draw agents
      agents.forEach(agent => {
        const bounce = agent.status === "working" ? Math.sin(frameRef.current * 0.1 + agent.frame) * 1.5 : 0;
        const ax = agent.x;
        const ay = agent.y + bounce;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(ax, ay + 12, 6, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = agent.color;
        ctx.fillRect(ax - 4, ay - 2, 8, 10);

        // Head
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(ax - 3, ay - 8, 6, 6);

        // Eyes
        ctx.fillStyle = "#0a0e14";
        const blink = frameRef.current % 120 < 3;
        if (!blink) {
          ctx.fillRect(ax - 2, ay - 6, 2, 2);
          ctx.fillRect(ax + 1, ay - 6, 2, 2);
        }

        // Status indicator
        const statusColor = agent.status === "working" ? "#10b981" : agent.status === "error" ? "#f43f5e" : agent.status === "talking" ? "#C9A84C" : "#64748b";
        ctx.fillStyle = statusColor;
        ctx.beginPath();
        ctx.arc(ax + 6, ay - 8, 2, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        if (agent.status === "working") {
          ctx.shadowColor = statusColor;
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.arc(ax + 6, ay - 8, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Typing animation
        if (agent.status === "working" && frameRef.current % 8 < 4) {
          ctx.fillStyle = agent.color + "80";
          ctx.fillRect(ax - 6 + (frameRef.current % 3) * 4, ay + 8, 2, 2);
        }

        // Speech bubble on hover
        if (hoveredAgent === agent.id || (agent.status === "talking" && frameRef.current % 200 < 100)) {
          const bubbleW = agent.message.length * 4 + 12;
          const bubbleX = ax - bubbleW / 2;
          const bubbleY = ay - 24;

          ctx.fillStyle = "rgba(12,16,23,0.9)";
          ctx.strokeStyle = agent.color + "60";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(bubbleX, bubbleY, bubbleW, 14, 4);
          ctx.fill();
          ctx.stroke();

          // Triangle
          ctx.fillStyle = "rgba(12,16,23,0.9)";
          ctx.beginPath();
          ctx.moveTo(ax - 3, bubbleY + 14);
          ctx.lineTo(ax + 3, bubbleY + 14);
          ctx.lineTo(ax, bubbleY + 18);
          ctx.fill();

          ctx.fillStyle = "#e2e8f0";
          ctx.font = "7px monospace";
          ctx.fillText(agent.message, bubbleX + 6, bubbleY + 10);
        }

        // Name label
        ctx.fillStyle = "#64748b";
        ctx.font = "6px monospace";
        ctx.textAlign = "center";
        ctx.fillText(agent.name, ax, ay + 24);
        ctx.textAlign = "start";
      });

      // Random agent movement
      if (frameRef.current % 180 === 0) {
        setAgents(prev => prev.map(a => {
          if (Math.random() > 0.7) {
            const statuses: Agent["status"][] = ["working", "idle", "working", "talking"];
            return { ...a, status: statuses[Math.floor(Math.random() * statuses.length)] };
          }
          return a;
        }));
      }

      // Title bar
      ctx.fillStyle = "rgba(6,8,12,0.8)";
      ctx.fillRect(0, 0, w, 18);
      ctx.fillStyle = "#C9A84C";
      ctx.font = "bold 8px monospace";
      ctx.fillText("SHORTSTACK HQ", 8, 12);
      ctx.fillStyle = "#64748b";
      ctx.font = "7px monospace";
      const working = agents.filter(a => a.status === "working").length;
      ctx.fillText(`${working}/${agents.length} agents active`, w - 100, 12);

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animId);
  }, [agents, hoveredAgent]);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    let found: string | null = null;
    for (const agent of agents) {
      if (Math.abs(x - agent.x) < 15 && Math.abs(y - agent.y) < 15) {
        found = agent.id;
        break;
      }
    }
    setHoveredAgent(found);
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border/30 bg-[#0a0e14]">
      <canvas
        ref={canvasRef}
        width={540}
        height={220}
        className="w-full cursor-pointer"
        style={{ imageRendering: "pixelated" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredAgent(null)}
      />
    </div>
  );
}
