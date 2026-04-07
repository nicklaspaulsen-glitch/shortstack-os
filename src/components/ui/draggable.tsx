"use client";

import { useRef, useState, useEffect, ReactNode } from "react";

interface DraggableProps {
  children: ReactNode;
  defaultX?: number;
  defaultY?: number;
  storageKey?: string;
}

export default function Draggable({ children, defaultX, defaultY, storageKey }: DraggableProps) {
  const [pos, setPos] = useState({ x: defaultX ?? 0, y: defaultY ?? 0 });
  const posRef = useRef(pos);
  const dragging = useRef(false);
  const hasMoved = useRef(false);
  const startOffset = useRef({ x: 0, y: 0 });
  const elRef = useRef<HTMLDivElement>(null);

  // Load saved position
  useEffect(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(`drag_${storageKey}`);
        if (saved) {
          const p = JSON.parse(saved);
          setPos(p);
          posRef.current = p;
        }
      } catch {}
    }
  }, [storageKey]);

  // Keep ref in sync
  useEffect(() => { posRef.current = pos; }, [pos]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Don't drag if clicking buttons/inputs inside
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a, textarea, select")) return;

    dragging.current = true;
    hasMoved.current = false;
    startOffset.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };

    // Capture pointer for smooth dragging even outside element
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    hasMoved.current = true;
    const newPos = {
      x: Math.max(0, Math.min(window.innerWidth - 60, e.clientX - startOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - startOffset.current.y)),
    };
    setPos(newPos);
    posRef.current = newPos;
  };

  const handlePointerUp = () => {
    if (dragging.current && hasMoved.current && storageKey) {
      localStorage.setItem(`drag_${storageKey}`, JSON.stringify(posRef.current));
    }
    dragging.current = false;
  };

  return (
    <div
      ref={elRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 50,
        touchAction: "none",
        userSelect: dragging.current ? "none" : "auto",
      }}
    >
      {children}
    </div>
  );
}
