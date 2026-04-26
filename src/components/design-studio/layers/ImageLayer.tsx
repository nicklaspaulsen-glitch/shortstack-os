"use client";

import React from "react";
import type { ImageLayer as ImageLayerType } from "@/lib/design/types";
import { Loader2 } from "lucide-react";

interface Props {
  layer: ImageLayerType;
  isSelected: boolean;
  scale: number;
  onSelect: (id: string, e: React.MouseEvent) => void;
}

export default function ImageLayer({ layer, isSelected, scale, onSelect }: Props) {
  if (layer.hidden) return null;

  const hasJob = Boolean(layer.jobId);

  const wrapperStyle: React.CSSProperties = {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    transform: `rotate(${layer.rotation}deg)`,
    opacity: layer.opacity,
    borderRadius: layer.borderRadius,
    overflow: "hidden",
    cursor: "pointer",
    outline: isSelected
      ? `${Math.max(1, 2 / scale)}px solid #3b82f6`
      : "none",
    outlineOffset: -1,
    boxSizing: "border-box",
  };

  const imgStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: layer.objectFit,
    display: "block",
    transform: `${layer.flipX ? "scaleX(-1)" : ""} ${layer.flipY ? "scaleY(-1)" : ""}`.trim() || "none",
  };

  return (
    <div
      style={wrapperStyle}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(layer.id, e);
      }}
    >
      {layer.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={layer.src} alt={layer.name} style={imgStyle} draggable={false} />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#2d2d3e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 8,
            color: "#666",
            fontSize: 12,
          }}
        >
          {hasJob ? (
            <>
              <Loader2 size={24} className="animate-spin text-blue-400" />
              <span>Generating…</span>
            </>
          ) : (
            <span>Image Placeholder</span>
          )}
        </div>
      )}
    </div>
  );
}
