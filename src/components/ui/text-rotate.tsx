"use client";

/**
 * TextRotate — vertical flip text rotation with spring physics.
 * Cycles through an array of strings, flipping each word in on the Y axis.
 * Adapted from 21st.dev/r/ibelick/text-rotate for ShortStack.
 *
 * Usage:
 *   <TextRotate
 *     texts={["Leads", "Deals", "Revenue", "Growth"]}
 *     className="text-indigo-600 font-bold"
 *   />
 */

import { useState, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TextRotateProps {
  texts: string[];
  /** Interval between rotations in ms — defaults to 2200 */
  interval?: number;
  /** Animation axis — defaults to "y" (vertical flip) */
  axis?: "y" | "x";
  className?: string;
  /** Additional classes for each text span */
  textClassName?: string;
}

export function TextRotate({
  texts,
  interval = 2200,
  axis = "y",
  className,
  textClassName,
}: TextRotateProps) {
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (texts.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % texts.length);
    }, interval);
    return () => clearInterval(id);
  }, [texts.length, interval]);

  if (reducedMotion) {
    return <span className={className}>{texts[0]}</span>;
  }

  const enterFrom = axis === "y" ? { rotateY: -90, opacity: 0 } : { rotateX: -90, opacity: 0 };
  const exitTo   = axis === "y" ? { rotateY:  90, opacity: 0 } : { rotateX:  90, opacity: 0 };

  return (
    <span
      className={cn("relative inline-block overflow-hidden", className)}
      // Reserve min-width so layout doesn't jump
      style={{ perspective: "600px" }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={texts[index]}
          className={cn("inline-block origin-center", textClassName)}
          initial={enterFrom}
          animate={{ rotateY: 0, rotateX: 0, opacity: 1 }}
          exit={exitTo}
          transition={{
            type: "spring",
            stiffness: 280,
            damping: 26,
            duration: 0.35,
          }}
          style={{ transformStyle: "preserve-3d" }}
        >
          {texts[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default TextRotate;
