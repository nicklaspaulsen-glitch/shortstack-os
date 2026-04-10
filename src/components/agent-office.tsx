"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

// Agent config
const AGENTS = [
  { id: "lead-engine", name: "Scout", color: "#10b981", role: "Leads" },
  { id: "outreach", name: "Echo", color: "#3b82f6", role: "Outreach" },
  { id: "content", name: "Pixel", color: "#a855f7", role: "Content" },
  { id: "ads", name: "Blaze", color: "#f59e0b", role: "Ads" },
  { id: "trinity", name: "Trinity", color: "#c8a855", role: "Boss" },
  { id: "analytics", name: "Lens", color: "#06b6d4", role: "Analytics" },
  { id: "reviews", name: "Star", color: "#eab308", role: "Reviews" },
  { id: "seo", name: "Rank", color: "#84cc16", role: "SEO" },
  { id: "invoice", name: "Ledger", color: "#22c55e", role: "Billing" },
  { id: "retention", name: "Keep", color: "#f43f5e", role: "Retention" },
  { id: "social-media", name: "Wave", color: "#ec4899", role: "Social" },
  { id: "scheduler", name: "Clock", color: "#14b8a6", role: "Calendar" },
];

// Office layout — grid of tiles (0=floor, 1=wall, 2=desk, 3=plant, 4=coffee)
const TILE_SIZE = 16;
const OFFICE_W = 52;
const OFFICE_H = 20;

// Simple BFS pathfinding
function findPath(grid: number[][], sx: number, sy: number, ex: number, ey: number): Array<[number, number]> {
  if (sx === ex && sy === ey) return [];
  const queue: Array<[number, number, Array<[number, number]>]> = [[sx, sy, []]];
  const visited = new Set<string>();
  visited.add(`${sx},${sy}`);
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  while (queue.length > 0) {
    const [cx, cy, path] = queue.shift()!;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= OFFICE_W || ny >= OFFICE_H) continue;
      if (visited.has(key)) continue;
      if (grid[ny]?.[nx] === 1) continue; // wall
      visited.add(key);
      const newPath: Array<[number, number]> = [...path, [nx, ny]];
      if (nx === ex && ny === ey) return newPath;
      queue.push([nx, ny, newPath]);
    }
  }
  return [];
}

interface Agent {
  id: string;
  name: string;
  color: string;
  role: string;
  x: number;
  y: number;
  state: "idle" | "walking" | "typing" | "talking";
  path: Array<[number, number]>;
  deskX: number;
  deskY: number;
  frame: number;
  facing: "left" | "right" | "down" | "up";
  actionsToday: number;
  stateTimer: number;
  bubbleText: string;
  bubbleTimer: number;
}

export default function AgentOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentsRef = useRef<Agent[]>([]);
  const gridRef = useRef<number[][]>([]);
  const animFrame = useRef<number>(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const supabase = createClient();

  // Initialize grid and agents
  useEffect(() => {
    // Build office grid
    const grid: number[][] = [];
    for (let y = 0; y < OFFICE_H; y++) {
      grid[y] = [];
      for (let x = 0; x < OFFICE_W; x++) {
        // Walls on edges
        if (y === 0 || y === OFFICE_H - 1 || x === 0 || x === OFFICE_W - 1) {
          grid[y][x] = 1;
        } else {
          grid[y][x] = 0; // floor
        }
      }
    }

    // Add desks
    const deskPositions: Array<[number, number]> = [];
    AGENTS.forEach((_, i) => {
      const row = Math.floor(i / 6);
      const col = i % 6;
      const dx = 4 + col * 8;
      const dy = 4 + row * 8;
      grid[dy][dx] = 2;
      grid[dy][dx + 1] = 2;
      deskPositions.push([dx, dy + 1]);
    });

    // Add decorations
    grid[2][26] = 4; // coffee machine
    grid[10][26] = 3; // plant
    grid[2][2] = 3; // plant
    grid[17][2] = 3; // plant
    grid[17][49] = 3; // plant

    gridRef.current = grid;

    // Initialize agents at their desks
    const agents: Agent[] = AGENTS.map((a, i) => {
      const pos = deskPositions[i] || [5, 5];
      return {
        ...a,
        x: pos[0],
        y: pos[1],
        deskX: pos[0],
        deskY: pos[1],
        state: "idle",
        path: [],
        frame: 0,
        facing: "down",
        actionsToday: 0,
        stateTimer: Math.random() * 200,
        bubbleText: "",
        bubbleTimer: 0,
      };
    });
    agentsRef.current = agents;

    // Fetch real activity data
    fetchActivity();
  }, []);

  async function fetchActivity() {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("trinity_log")
      .select("agent, description")
      .gte("created_at", today)
      .order("created_at", { ascending: false })
      .limit(50);

    const counts: Record<string, { count: number; last: string }> = {};
    (data || []).forEach(l => {
      const aid = l.agent || "";
      if (!counts[aid]) counts[aid] = { count: 0, last: "" };
      counts[aid].count++;
      if (!counts[aid].last) counts[aid].last = (l.description || "").substring(0, 30);
    });

    agentsRef.current = agentsRef.current.map(a => {
      const d = counts[a.id];
      return {
        ...a,
        actionsToday: d?.count || 0,
        state: d?.count ? "typing" : "idle",
        bubbleText: d?.last || "",
        bubbleTimer: d?.count ? 120 : 0,
      };
    });
  }

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function gameLoop() {
      if (!ctx || !canvas) return;
      const agents = agentsRef.current;
      const grid = gridRef.current;

      // Update agents
      agents.forEach(agent => {
        agent.frame++;
        agent.stateTimer--;
        if (agent.bubbleTimer > 0) agent.bubbleTimer--;

        // Move along path
        if (agent.path.length > 0 && agent.frame % 4 === 0) {
          const [nx, ny] = agent.path.shift()!;
          // Determine facing
          if (nx > agent.x) agent.facing = "right";
          else if (nx < agent.x) agent.facing = "left";
          else if (ny > agent.y) agent.facing = "down";
          else agent.facing = "up";
          agent.x = nx;
          agent.y = ny;
          agent.state = "walking";
        } else if (agent.path.length === 0 && agent.state === "walking") {
          agent.state = agent.actionsToday > 0 ? "typing" : "idle";
        }

        // Randomly decide to move
        if (agent.stateTimer <= 0 && agent.path.length === 0) {
          agent.stateTimer = 100 + Math.random() * 300;

          if (agent.state === "typing" && Math.random() > 0.7) {
            // Walk to coffee or another agent
            const targets = [
              [26, 3], // coffee
              [26, 10], // meeting spot
              [agent.deskX + (Math.random() > 0.5 ? 3 : -3), agent.deskY],
            ];
            const t = targets[Math.floor(Math.random() * targets.length)];
            const tx = Math.max(1, Math.min(OFFICE_W - 2, Math.round(t[0])));
            const ty = Math.max(1, Math.min(OFFICE_H - 2, Math.round(t[1])));
            agent.path = findPath(grid, agent.x, agent.y, tx, ty);
            if (agent.path.length > 0) {
              agent.bubbleText = ["coffee...", "brb", "hmm", "done!", "let me check"][Math.floor(Math.random() * 5)];
              agent.bubbleTimer = 60;
            }
          } else if (agent.x !== agent.deskX || agent.y !== agent.deskY) {
            // Return to desk
            agent.path = findPath(grid, agent.x, agent.y, agent.deskX, agent.deskY);
          }
        }
      });

      // Render
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Floor
      ctx.fillStyle = "#0d1017";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid tiles
      for (let y = 0; y < OFFICE_H; y++) {
        for (let x = 0; x < OFFICE_W; x++) {
          const tile = grid[y]?.[x] || 0;
          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;

          if (tile === 0) {
            // Floor tile with subtle pattern
            ctx.fillStyle = (x + y) % 2 === 0 ? "#111520" : "#121622";
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          } else if (tile === 1) {
            // Wall
            ctx.fillStyle = "#1a1f2e";
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = "#222838";
            ctx.fillRect(px, py, TILE_SIZE, 2);
          } else if (tile === 2) {
            // Desk
            ctx.fillStyle = "#2a2520";
            ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
            // Monitor on desk
            ctx.fillStyle = "#334155";
            ctx.fillRect(px + 3, py + 2, TILE_SIZE - 6, TILE_SIZE - 6);
            ctx.fillStyle = "#1e293b";
            ctx.fillRect(px + 4, py + 3, TILE_SIZE - 8, TILE_SIZE - 8);
          } else if (tile === 3) {
            // Plant
            ctx.fillStyle = "#422";
            ctx.fillRect(px + 5, py + 8, 6, 8);
            ctx.fillStyle = "#166534";
            ctx.beginPath();
            ctx.arc(px + 8, py + 6, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#22c55e";
            ctx.beginPath();
            ctx.arc(px + 7, py + 5, 3, 0, Math.PI * 2);
            ctx.fill();
          } else if (tile === 4) {
            // Coffee machine
            ctx.fillStyle = "#44403c";
            ctx.fillRect(px + 2, py + 2, 12, 12);
            ctx.fillStyle = "#78716c";
            ctx.fillRect(px + 4, py + 4, 8, 5);
            ctx.fillStyle = "#ef4444";
            ctx.fillRect(px + 6, py + 10, 4, 2); // red light
          }
        }
      }

      // Render agents (sorted by Y for proper overlap)
      const sortedAgents = [...agents].sort((a, b) => a.y - b.y);

      sortedAgents.forEach(agent => {
        const px = agent.x * TILE_SIZE;
        const py = agent.y * TILE_SIZE;
        const color = agent.color;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(px + 8, py + 14, 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = color;
        ctx.fillRect(px + 4, py + 5, 8, 7);

        // Head
        const headBob = agent.state === "walking" ? Math.sin(agent.frame / 3) * 0.5 : 0;
        ctx.fillStyle = "#fcd9b6"; // skin
        ctx.fillRect(px + 4, py + headBob, 8, 6);

        // Hair (colored)
        ctx.fillStyle = color;
        ctx.fillRect(px + 3, py - 1 + headBob, 10, 3);

        // Eyes
        const blink = agent.frame % 120 < 5;
        if (!blink) {
          ctx.fillStyle = "#1a1a2e";
          const eyeOffsetX = agent.facing === "left" ? -1 : agent.facing === "right" ? 1 : 0;
          ctx.fillRect(px + 5 + eyeOffsetX, py + 2 + headBob, 2, 2);
          ctx.fillRect(px + 9 + eyeOffsetX, py + 2 + headBob, 2, 2);
        } else {
          ctx.fillStyle = "#1a1a2e";
          ctx.fillRect(px + 5, py + 3 + headBob, 2, 1);
          ctx.fillRect(px + 9, py + 3 + headBob, 2, 1);
        }

        // Legs (animate when walking)
        if (agent.state === "walking") {
          const legAnim = Math.sin(agent.frame / 2) * 2;
          ctx.fillStyle = "#374151";
          ctx.fillRect(px + 5, py + 12, 3, 3 + legAnim);
          ctx.fillRect(px + 9, py + 12, 3, 3 - legAnim);
        } else {
          ctx.fillStyle = "#374151";
          ctx.fillRect(px + 5, py + 12, 3, 3);
          ctx.fillRect(px + 9, py + 12, 3, 3);
        }

        // Typing animation
        if (agent.state === "typing" && agent.x === agent.deskX && agent.y === agent.deskY) {
          // Hands moving
          if (agent.frame % 10 < 5) {
            ctx.fillStyle = "#fcd9b6";
            ctx.fillRect(px + 2, py + 8, 3, 2);
            ctx.fillRect(px + 12, py + 9, 3, 2);
          } else {
            ctx.fillStyle = "#fcd9b6";
            ctx.fillRect(px + 2, py + 9, 3, 2);
            ctx.fillRect(px + 12, py + 8, 3, 2);
          }
        }

        // Speech bubble
        if (agent.bubbleTimer > 0 && agent.bubbleText) {
          const textWidth = agent.bubbleText.length * 4 + 8;
          const bx = px + 8 - textWidth / 2;
          const by = py - 14;

          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.beginPath();
          ctx.roundRect(bx, by, textWidth, 10, 3);
          ctx.fill();

          // Bubble pointer
          ctx.beginPath();
          ctx.moveTo(px + 6, by + 10);
          ctx.lineTo(px + 8, by + 13);
          ctx.lineTo(px + 10, by + 10);
          ctx.fill();

          ctx.fillStyle = "#111";
          ctx.font = "6px monospace";
          ctx.fillText(agent.bubbleText, bx + 4, by + 7);
        }

        // Name below (only on hover)
        if (hovered === agent.id) {
          ctx.fillStyle = color;
          ctx.font = "bold 7px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(agent.name, px + 8, py + 22);
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.font = "6px sans-serif";
          ctx.fillText(`${agent.role} · ${agent.actionsToday} today`, px + 8, py + 29);
          ctx.textAlign = "left";
        }

        // Status indicator
        if (agent.actionsToday > 0) {
          ctx.fillStyle = "#22c55e";
          ctx.beginPath();
          ctx.arc(px + 14, py, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Top label
      ctx.fillStyle = "rgba(200,168,85,0.3)";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText(`AGENT OFFICE · ${agents.filter(a => a.actionsToday > 0).length}/${agents.length} active`, 10, 12);

      animFrame.current = requestAnimationFrame(gameLoop);
    }

    animFrame.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animFrame.current);
  }, [hovered]);

  // Mouse hover detection
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    // Check if hovering over an agent
    let found: string | null = null;
    agentsRef.current.forEach(agent => {
      const px = agent.x * TILE_SIZE;
      const py = agent.y * TILE_SIZE;
      if (mx >= px && mx <= px + 16 && my >= py - 4 && my <= py + 16) {
        found = agent.id;
      }
    });
    setHovered(found);
  }, []);

  return (
    <Link href="/dashboard/agent-supervisor" className="block">
      <div className="rounded-xl overflow-hidden cursor-pointer hover:ring-1 hover:ring-gold/10 transition-all"
        style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
        <canvas
          ref={canvasRef}
          width={OFFICE_W * TILE_SIZE}
          height={OFFICE_H * TILE_SIZE}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
          className="w-full"
          style={{ imageRendering: "pixelated", height: "auto" }}
        />
      </div>
    </Link>
  );
}
