"use client";

import { useEffect, useState } from "react";

interface Particle {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

export default function FloatingParticles({ count = 20 }: { count?: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Check for reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const p: Particle[] = [];
    for (let i = 0; i < count; i++) {
      p.push({
        id: i,
        left: Math.random() * 100,
        size: 1 + Math.random() * 2,
        duration: 12 + Math.random() * 20,
        delay: Math.random() * 15,
        opacity: 0.05 + Math.random() * 0.15,
      });
    }
    setParticles(p);
  }, [count]);

  if (particles.length === 0) return null;

  return (
    <div className="particles-container">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
