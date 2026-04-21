"use client";

import { useRef, useState, useEffect, ReactNode } from "react";

interface DraggableProps {
  children: ReactNode;
  defaultX?: number;
  defaultY?: number;
  storageKey?: string;
  /**
   * When true, drags start even if the pointerdown target is a button/input/etc.
   * A click-capture guard then swallows the trailing click if a drag actually
   * moved, so the underlying button's onClick doesn't fire at drag-end.
   * Use for wrappers around a single clickable element (e.g. a floating pill).
   */
  dragAnywhere?: boolean;
}

export default function Draggable({ children, defaultX, defaultY, storageKey, dragAnywhere }: DraggableProps) {
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
          // Validate saved position is still within viewport
          const el = elRef.current;
          const w = el?.offsetWidth || 60;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const h = el?.offsetHeight || 60;
          p.x = Math.max(0, Math.min(window.innerWidth - w, p.x));
          p.y = Math.max(0, Math.min(window.innerHeight - h, p.y));
          setPos(p);
          posRef.current = p;
        }
      } catch {}
    }
  }, [storageKey]);

  // Keep ref in sync
  useEffect(() => { posRef.current = pos; }, [pos]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Don't drag if clicking buttons/inputs inside — unless the whole wrapper
    // IS a clickable control (dragAnywhere), in which case we let the drag
    // start and rely on onClickCapture to swallow the click if moved.
    if (!dragAnywhere) {
      const target = e.target as HTMLElement;
      if (target.closest("button, input, a, textarea, select")) return;
    }

    dragging.current = true;
    hasMoved.current = false;
    startOffset.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };

    // Capture pointer for smooth dragging even outside element
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    // If a drag actually moved, swallow the trailing click so the underlying
    // button's onClick doesn't fire (otherwise the panel opens every time
    // the user finishes dragging the pill).
    if (hasMoved.current) {
      e.preventDefault();
      e.stopPropagation();
      hasMoved.current = false;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    hasMoved.current = true;

    // Use actual element size for boundary clamping
    const el = elRef.current;
    const w = el?.offsetWidth || 60;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const h = el?.offsetHeight || 60;

    const newPos = {
      x: Math.max(-w + 20, Math.min(window.innerWidth - 20, e.clientX - startOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 20, e.clientY - startOffset.current.y)),
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
      onClickCapture={handleClickCapture}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 50,
        touchAction: "none",
        userSelect: dragging.current ? "none" : "auto",
        cursor: dragging.current ? "grabbing" : undefined,
      }}
    >
      {children}
    </div>
  );
}
