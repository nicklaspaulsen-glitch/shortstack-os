"use client";

import { ReactNode, useEffect } from "react";
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
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className={`relative w-full ${sizeClasses[size]} mx-4 bg-surface border border-border/50 rounded-xl shadow-2xl shadow-black/50 fade-in max-h-[85vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30 sticky top-0 bg-surface/95 backdrop-blur-sm z-10">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-surface-light text-muted hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
