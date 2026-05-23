"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export default function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    // Scroll-lock that preserves visual position. Plain
    // `body.overflow = hidden` can make the page snap back to the top in
    // some browsers — the user clicks Manage on a tile near the bottom,
    // the modal opens centered in viewport, but the page underneath has
    // jumped to scrollY=0 so it feels like the modal popped up "in the
    // wrong place". The position:fixed + top:-scrollY trick keeps the
    // background visually pinned where it was, so the modal centers in
    // the viewport the user actually had open.
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.overflow = "";
      window.scrollTo({ top: scrollY, behavior: "instant" });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative w-full ${sizeClasses[size]} mx-4 bg-surface border border-border-subtle/50 rounded-xl shadow-2xl shadow-black/50 max-h-[85vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle/30 sticky top-0 bg-surface/95 backdrop-blur-sm z-10">
          <h2 id="modal-title" className="text-sm font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-md hover:bg-surface-light text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
