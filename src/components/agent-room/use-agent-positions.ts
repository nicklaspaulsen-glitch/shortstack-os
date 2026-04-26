"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentDef } from "./roster";
import { absolutePosition } from "./roster";

export interface Position {
  x: number; // % of container (0–100)
  y: number;
}

type PositionMap = Record<string, Position>;

const STORAGE_KEY = "agent-room-positions";

function loadFromStorage(): PositionMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PositionMap;
  } catch {
    // localStorage unavailable (private mode, SSR)
  }
  return {};
}

function saveToStorage(map: PositionMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/**
 * Returns the resolved (x, y) position for each agent and a setter that
 * updates the position when the user drags an avatar.
 *
 * Positions start from the roster's `absolutePosition()` calculation and are
 * overridden by whatever the user has dragged them to. Overrides survive page
 * refreshes via localStorage.
 */
export function useAgentPositions(agents: AgentDef[]): {
  getPosition: (id: string) => Position;
  setPosition: (id: string, pos: Position) => void;
  resetPositions: () => void;
} {
  const defaultsRef = useRef<PositionMap>({});

  // Pre-compute static defaults once.
  for (const agent of agents) {
    if (!defaultsRef.current[agent.id]) {
      defaultsRef.current[agent.id] = absolutePosition(agent);
    }
  }

  const [overrides, setOverrides] = useState<PositionMap>({});

  // Hydrate from localStorage after mount (avoid SSR mismatch).
  useEffect(() => {
    const stored = loadFromStorage();
    if (Object.keys(stored).length > 0) setOverrides(stored);
  }, []);

  const getPosition = useCallback(
    (id: string): Position => overrides[id] ?? defaultsRef.current[id] ?? { x: 50, y: 50 },
    [overrides]
  );

  const setPosition = useCallback((id: string, pos: Position) => {
    setOverrides(prev => {
      const next = { ...prev, [id]: pos };
      saveToStorage(next);
      return next;
    });
  }, []);

  const resetPositions = useCallback(() => {
    setOverrides({});
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return { getPosition, setPosition, resetPositions };
}
