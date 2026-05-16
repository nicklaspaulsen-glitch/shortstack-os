"use client";

/**
 * FallingPattern — canvas-based falling shapes background.
 * Renders lightweight animated particles (circles, crosses, dots) that
 * drift downward at varying speeds and opacities. Completely non-interactive,
 * pointer-events none, respects prefers-reduced-motion.
 * Adapted from 21st.dev/r/serafimcloud/falling-pattern.
 *
 * Usage:
 *   <div className="relative overflow-hidden">
 *     <FallingPattern color="#2563EB" density={30} />
 *     <YourContent className="relative z-10" />
 *   </div>
 */

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  drift: number; // horizontal drift rate
  rotation: number;
  rotationSpeed: number;
  shape: "circle" | "cross" | "square" | "diamond";
}

interface FallingPatternProps {
  /** Base color for particles — defaults to brand blue */
  color?: string;
  /** Number of particles — defaults to 24 */
  density?: number;
  /** Particle size range [min, max] in px */
  sizeRange?: [number, number];
  /** Fall speed range [min, max] px/frame */
  speedRange?: [number, number];
  /** Opacity range [min, max] */
  opacityRange?: [number, number];
  className?: string;
}

function randomBetween(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

const SHAPES: Particle["shape"][] = ["circle", "cross", "square", "diamond"];

export function FallingPattern({
  color = "#2563EB",
  density = 24,
  sizeRange = [3, 10],
  speedRange = [0.3, 1.2],
  opacityRange = [0.04, 0.16],
  className,
}: FallingPatternProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Respect reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Spawn initial particles spread across full height
    particlesRef.current = Array.from({ length: density }, () => ({
      x: randomBetween(0, canvas.width),
      y: randomBetween(0, canvas.height),
      size: randomBetween(...sizeRange),
      speed: randomBetween(...speedRange),
      opacity: randomBetween(...opacityRange),
      drift: randomBetween(-0.15, 0.15),
      rotation: randomBetween(0, Math.PI * 2),
      rotationSpeed: randomBetween(-0.01, 0.01),
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    }));

    const drawParticle = (p: Particle) => {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;

      const s = p.size;
      switch (p.shape) {
        case "circle":
          ctx.beginPath();
          ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "square":
          ctx.fillRect(-s / 2, -s / 2, s, s);
          break;
        case "diamond":
          ctx.beginPath();
          ctx.moveTo(0, -s / 2);
          ctx.lineTo(s / 2, 0);
          ctx.lineTo(0, s / 2);
          ctx.lineTo(-s / 2, 0);
          ctx.closePath();
          ctx.fill();
          break;
        case "cross":
          const arm = s * 0.35;
          const thick = s * 0.12;
          ctx.fillRect(-arm, -thick, arm * 2, thick * 2);
          ctx.fillRect(-thick, -arm, thick * 2, arm * 2);
          break;
      }

      ctx.restore();
    };

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.map((p) => {
        let y = p.y + p.speed;
        let x = p.x + p.drift;

        // Wrap around when off screen
        if (y > canvas.height + p.size) y = -p.size;
        if (x > canvas.width + p.size) x = -p.size;
        if (x < -p.size) x = canvas.width + p.size;

        const updated = { ...p, x, y, rotation: p.rotation + p.rotationSpeed };
        drawParticle(updated);
        return updated;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [color, density, sizeRange, speedRange, opacityRange]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
}

export default FallingPattern;
