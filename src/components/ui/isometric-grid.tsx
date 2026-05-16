"use client";

/**
 * IsometricGrid — animated isometric wave grid background.
 * Renders a canvas-based isometric tile grid where tiles pulse in a
 * sine-wave pattern emanating from a focal point.
 * Adapted from 21st.dev/r/serafimcloud/isometric-wave-grid-background.
 *
 * Usage:
 *   <div className="relative h-64 overflow-hidden rounded-xl">
 *     <IsometricGrid color="#2563EB" />
 *     <YourContent className="relative z-10" />
 *   </div>
 */

import { useEffect, useRef } from "react";

interface IsometricGridProps {
  /** Tile stroke + fill base color — defaults to brand blue */
  color?: string;
  /** Number of columns — defaults to 18 */
  cols?: number;
  /** Number of rows — defaults to 12 */
  rows?: number;
  /** Wave speed — defaults to 1 */
  speed?: number;
  className?: string;
}

export function IsometricGrid({
  color = "#2563EB",
  cols = 18,
  rows = 12,
  speed = 1,
  className,
}: IsometricGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let t = 0;

    // Parse color to r,g,b for alpha manipulation
    // We'll use the color directly in ctx with globalAlpha
    const tick = () => {
      t += 0.02 * speed;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const tileW = canvas.width / cols;
      const tileH = tileW * 0.55; // isometric ratio

      // Offset to center the grid
      const offsetX = (canvas.width - cols * tileW) / 2;
      const offsetY = (canvas.height - rows * tileH) / 2;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Isometric screen position
          const screenX = offsetX + col * tileW + (row % 2 === 0 ? 0 : tileW / 2);
          const screenY = offsetY + row * (tileH * 0.75);

          // Wave based on distance from grid center
          const cx = cols / 2;
          const cy = rows / 2;
          const dist = Math.sqrt((col - cx) ** 2 + (row - cy) ** 2);
          const wave = Math.sin(dist * 0.6 - t) * 0.5 + 0.5; // 0..1

          // Height of the top face extrusion
          const h = wave * tileH * 0.5;
          const alpha = 0.06 + wave * 0.14;

          // Draw top face (parallelogram)
          ctx.beginPath();
          ctx.moveTo(screenX, screenY - h);
          ctx.lineTo(screenX + tileW / 2, screenY - tileH / 2 - h);
          ctx.lineTo(screenX + tileW, screenY - h);
          ctx.lineTo(screenX + tileW / 2, screenY + tileH / 2 - h);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.globalAlpha = alpha * 1.4;
          ctx.fill();

          // Draw left face
          ctx.beginPath();
          ctx.moveTo(screenX, screenY - h);
          ctx.lineTo(screenX + tileW / 2, screenY + tileH / 2 - h);
          ctx.lineTo(screenX + tileW / 2, screenY + tileH / 2);
          ctx.lineTo(screenX, screenY);
          ctx.closePath();
          ctx.globalAlpha = alpha * 0.7;
          ctx.fill();

          // Draw right face
          ctx.beginPath();
          ctx.moveTo(screenX + tileW, screenY - h);
          ctx.lineTo(screenX + tileW / 2, screenY + tileH / 2 - h);
          ctx.lineTo(screenX + tileW / 2, screenY + tileH / 2);
          ctx.lineTo(screenX + tileW, screenY);
          ctx.closePath();
          ctx.globalAlpha = alpha * 0.5;
          ctx.fill();

          // Stroke outline
          ctx.globalAlpha = alpha * 0.8;
          ctx.strokeStyle = color;
          ctx.lineWidth = 0.5;

          // Outline top face
          ctx.beginPath();
          ctx.moveTo(screenX, screenY - h);
          ctx.lineTo(screenX + tileW / 2, screenY - tileH / 2 - h);
          ctx.lineTo(screenX + tileW, screenY - h);
          ctx.lineTo(screenX + tileW / 2, screenY + tileH / 2 - h);
          ctx.closePath();
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [color, cols, rows, speed]);

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
      }}
    />
  );
}

export default IsometricGrid;
