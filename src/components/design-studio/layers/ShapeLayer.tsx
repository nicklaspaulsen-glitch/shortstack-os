"use client";

import React from "react";
import type { ShapeLayer as ShapeLayerType } from "@/lib/design/types";

interface Props {
  layer: ShapeLayerType;
  isSelected: boolean;
  scale: number;
  onSelect: (id: string, e: React.MouseEvent) => void;
}

export default function ShapeLayer({ layer, isSelected, scale, onSelect }: Props) {
  if (layer.hidden) return null;

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    transform: `rotate(${layer.rotation}deg)`,
    opacity: layer.opacity,
    backgroundColor: layer.fill,
    border: layer.strokeWidth > 0 ? `${layer.strokeWidth}px solid ${layer.stroke}` : "none",
    cursor: "pointer",
    boxSizing: "border-box",
    outline: isSelected
      ? `${Math.max(1, 2 / scale)}px solid #3b82f6`
      : "none",
    outlineOffset: -1,
  };

  if (layer.shapeType === "ellipse") {
    baseStyle.borderRadius = "50%";
  } else if (layer.shapeType === "rectangle") {
    baseStyle.borderRadius = layer.borderRadius;
  } else if (layer.shapeType === "triangle") {
    baseStyle.backgroundColor = "transparent";
    baseStyle.border = "none";
    baseStyle.width = 0;
    baseStyle.height = 0;
    baseStyle.borderLeft = `${layer.width / 2}px solid transparent`;
    baseStyle.borderRight = `${layer.width / 2}px solid transparent`;
    baseStyle.borderBottom = `${layer.height}px solid ${layer.fill}`;
  }

  return (
    <div
      style={baseStyle}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(layer.id, e);
      }}
    />
  );
}
