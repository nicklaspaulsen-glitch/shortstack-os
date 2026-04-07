"use client";

import { useRef, useState, useCallback, ReactNode } from "react";

interface DraggableProps {
  children: ReactNode;
  defaultX?: number;
  defaultY?: number;
  storageKey?: string;
}

export default function Draggable({ children, defaultX, defaultY, storageKey }: DraggableProps) {
  const [pos, setPos] = useState(() => {
    if (storageKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(`drag_${storageKey}`);
      if (saved) return JSON.parse(saved);
    }
    return { x: defaultX ?? 0, y: defaultY ?? 0 };
  });

  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag on the handle (the element itself, not children buttons)
    if ((e.target as HTMLElement).closest("button, input, a, textarea")) return;
    dragging.current = true;
    moved.current = false;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      moved.current = true;
      const newX = e.clientX - offset.current.x;
      const newY = e.clientY - offset.current.y;
      setPos({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      dragging.current = false;
      if (storageKey && moved.current) {
        localStorage.setItem(`drag_${storageKey}`, JSON.stringify(pos));
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [pos, storageKey]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 50,
        cursor: dragging.current ? "grabbing" : "grab",
      }}
    >
      {children}
    </div>
  );
}
