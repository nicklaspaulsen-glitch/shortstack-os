"use client";

import React from "react";
import type { TextLayer as TextLayerType } from "@/lib/design/types";

interface Props {
  layer: TextLayerType;
  isSelected: boolean;
  scale: number;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onDoubleClick?: (id: string) => void;
}

export default function TextLayer({ layer, isSelected, scale, onSelect, onDoubleClick }: Props) {
  if (layer.hidden) return null;

  const style: React.CSSProperties = {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    transform: `rotate(${layer.rotation}deg)`,
    opacity: layer.opacity,
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize,
    fontWeight: layer.fontWeight,
    fontStyle: layer.fontStyle,
    textAlign: layer.textAlign,
    color: layer.color,
    lineHeight: layer.lineHeight,
    letterSpacing: layer.letterSpacing,
    textDecoration: layer.textDecoration,
    backgroundColor: layer.backgroundColor ?? "transparent",
    padding: layer.padding,
    borderRadius: layer.borderRadius,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflow: "hidden",
    cursor: "pointer",
    userSelect: "none",
    boxSizing: "border-box",
    outline: isSelected
      ? `${Math.max(1, 2 / scale)}px solid #3b82f6`
      : "none",
    outlineOffset: -1,
  };

  return (
    <div
      style={style}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(layer.id, e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(layer.id);
      }}
    >
      {layer.content}
    </div>
  );
}
