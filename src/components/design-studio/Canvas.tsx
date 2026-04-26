"use client";

import React, { useRef, useCallback } from "react";
import { useDesignStore } from "@/lib/design/store";
import type { Layer } from "@/lib/design/types";
import TextLayerComp from "./layers/TextLayer";
import ImageLayerComp from "./layers/ImageLayer";
import ShapeLayerComp from "./layers/ShapeLayer";
import GroupLayerComp from "./layers/GroupLayer";

interface DragState {
  layerId: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

export default function Canvas() {
  const design = useDesignStore((s) => s.design);
  const pageIndex = useDesignStore((s) => s.pageIndex);
  const selection = useDesignStore((s) => s.selection);
  const zoom = useDesignStore((s) => s.zoom);
  const showGrid = useDesignStore((s) => s.showGrid);
  const setSelection = useDesignStore((s) => s.setSelection);
  const updateLayer = useDesignStore((s) => s.updateLayer);

  const dragRef = useRef<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const page = design?.doc.pages[pageIndex];
  const width = design?.width ?? 1080;
  const height = design?.height ?? 1080;

  const handleLayerSelect = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.shiftKey) {
        // Multi-select
        const ids = selection.layerIds.includes(id)
          ? selection.layerIds.filter((x) => x !== id)
          : [...selection.layerIds, id];
        setSelection({ layerIds: ids });
      } else {
        setSelection({ layerIds: [id] });
      }
      // Begin drag tracking
      if (!page) return;
      const layer = page.layers[id];
      if (!layer || layer.locked) return;
      dragRef.current = {
        layerId: id,
        startX: e.clientX,
        startY: e.clientY,
        origX: layer.x,
        origY: layer.y,
      };
    },
    [selection, setSelection, page],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (e.clientX - dragRef.current.startX) / zoom;
      const dy = (e.clientY - dragRef.current.startY) / zoom;
      const newX = Math.round(dragRef.current.origX + dx);
      const newY = Math.round(dragRef.current.origY + dy);
      updateLayer(dragRef.current.layerId, { x: newX, y: newY } as Partial<Layer>);
    },
    [zoom, updateLayer],
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current) {
        setSelection({ layerIds: [] });
      }
    },
    [setSelection],
  );

  if (!design || !page) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#111] text-gray-500 text-sm">
        No design loaded
      </div>
    );
  }

  const orderedLayers = page.layerIds
    .map((id) => page.layers[id])
    .filter((l): l is Layer => Boolean(l));

  return (
    <div className="flex-1 overflow-auto flex items-center justify-center bg-[#111] select-none">
      {/* Canvas wrapper — provides scroll + centering */}
      <div style={{ padding: 40 }}>
        <div
          ref={canvasRef}
          style={{
            position: "relative",
            width: width * zoom,
            height: height * zoom,
            transform: `scale(1)`, // actual zoom applied via CSS transform on inner
            transformOrigin: "top left",
            cursor: "default",
            boxShadow: "0 8px 48px rgba(0,0,0,0.8)",
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
        >
          {/* Inner canvas — scaled to zoom */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width,
              height,
              backgroundColor: page.backgroundColor,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              overflow: "hidden",
            }}
          >
            {/* Grid overlay */}
            {showGrid && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                  pointerEvents: "none",
                  zIndex: 9999,
                }}
              />
            )}

            {/* Layers */}
            {orderedLayers.map((layer) => {
              const isSelected = selection.layerIds.includes(layer.id);
              if (layer.kind === "text") {
                return (
                  <TextLayerComp
                    key={layer.id}
                    layer={layer}
                    isSelected={isSelected}
                    scale={zoom}
                    onSelect={handleLayerSelect}
                  />
                );
              }
              if (layer.kind === "image") {
                return (
                  <ImageLayerComp
                    key={layer.id}
                    layer={layer}
                    isSelected={isSelected}
                    scale={zoom}
                    onSelect={handleLayerSelect}
                  />
                );
              }
              if (layer.kind === "shape") {
                return (
                  <ShapeLayerComp
                    key={layer.id}
                    layer={layer}
                    isSelected={isSelected}
                    scale={zoom}
                    onSelect={handleLayerSelect}
                  />
                );
              }
              if (layer.kind === "group") {
                return (
                  <GroupLayerComp
                    key={layer.id}
                    layer={layer}
                    page={page}
                    isSelected={isSelected}
                    selectedIds={selection.layerIds}
                    scale={zoom}
                    onSelect={handleLayerSelect}
                  />
                );
              }
              return null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
