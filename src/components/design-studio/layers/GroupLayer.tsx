"use client";

import React from "react";
import type { GroupLayer as GroupLayerType, Layer, Page } from "@/lib/design/types";
import TextLayer from "./TextLayer";
import ImageLayer from "./ImageLayer";
import ShapeLayer from "./ShapeLayer";

interface Props {
  layer: GroupLayerType;
  page: Page;
  isSelected: boolean;
  selectedIds: string[];
  scale: number;
  onSelect: (id: string, e: React.MouseEvent) => void;
}

export default function GroupLayer({ layer, page, isSelected, selectedIds, scale, onSelect }: Props) {
  if (layer.hidden) return null;

  const style: React.CSSProperties = {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    transform: `rotate(${layer.rotation}deg)`,
    opacity: layer.opacity,
    outline: isSelected ? `${Math.max(1, 2 / scale)}px dashed #3b82f6` : "none",
    outlineOffset: -1,
    cursor: "pointer",
  };

  return (
    <div
      style={style}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(layer.id, e);
      }}
    >
      {layer.children.map((childId) => {
        const child = page.layers[childId] as Layer | undefined;
        if (!child) return null;
        const childSelected = selectedIds.includes(childId);

        // Offset child position relative to group
        const offsetChild = { ...child, x: child.x - layer.x, y: child.y - layer.y };

        if (child.kind === "text") {
          return (
            <TextLayer
              key={childId}
              layer={offsetChild as typeof child}
              isSelected={childSelected}
              scale={scale}
              onSelect={onSelect}
            />
          );
        }
        if (child.kind === "image") {
          return (
            <ImageLayer
              key={childId}
              layer={offsetChild as typeof child}
              isSelected={childSelected}
              scale={scale}
              onSelect={onSelect}
            />
          );
        }
        if (child.kind === "shape") {
          return (
            <ShapeLayer
              key={childId}
              layer={offsetChild as typeof child}
              isSelected={childSelected}
              scale={scale}
              onSelect={onSelect}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
