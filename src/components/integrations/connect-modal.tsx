/**
 * Branded OAuth confirmation modal.
 *
 * Shown right before the Nango popup launches. Lets the user see exactly
 * which scopes/permissions they're about to grant and gives a single
 * "Authorize" button that triggers the actual Nango flow.
 *
 * Visual language matches `<PageHero>`: a thin gradient bar at the top, soft
 * shadows, deep dark surface in dark mode, light surface in light mode. The
 * ShortStack mandala lives top-left; the integration's own logo (or a
 * fallback initial) sits centered above the heading.
 *
 * Accessibility:
 * - Focus trap on open, restores focus on close.
 * - Escape key closes (calls onCancel).
 * - Backdrop click closes.
 * - aria-labelledby + aria-describedby + role="dialog".
 */

"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Check, X } from "lucide-react";
import Logo, { SHORTSTACK_GOLD } from "@/components/logo";
import { BRAND } from "@/lib/brand-config";

export interface ConnectModalProps {
  /** Display name of the integration (e.g. "Google Ads"). */
  integrationName: string;
  /** Nango integration ID (e.g. "google-zanb"). Shown subtly under the heading. */
  integrationId: string;
  /** Bullet list of scopes / permissions we're requesting. */
  scopesDescription: string[];
  /** Optional integration logo URL. Falls back to a styled letter avatar. */
  logoUrl?: string;
  /** Called when the user clicks "Authorize". Should kick off the Nango flow. */
  onConfirm: () => void;
  /** Called when the user clicks "Cancel", presses Escape, or clicks the
   *  backdrop. */
  onCancel: () => void;
  /** Optional override for the heading. Default: "Connect {integrationName}
   *  to {BRAND.company_name} OS". */
  heading?: string;
  /** Optional supporting copy under the heading. */
  description?: string;
}

export default function ConnectModal({
  integrationName,
  integrationId,
  scopesDescription,
  logoUrl,
  onConfirm,
  onCancel,
  heading,
  description,
}: ConnectModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Lock body scroll + capture previously-focused element so we can restore.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog on open. Confirm button is the safer default
    // than auto-firing — user can still tab to Cancel before pressing Enter.
    confirmRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, []);

  // Esc to close + simple focus trap.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  const titleId = "connect-modal-title";
  const descId = "connect-modal-description";
  const computedHeading = heading || `Connect ${integrationName} to ${BRAND.company_name} OS`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="presentation"
    >
      {/* Backdrop — click to cancel. aria-hidden because the dialog itself
       *  carries the semantics. */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        aria-hidden="true"
        onClick={onCancel}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative w-full max-w-md mx-4 rounded-2xl border border-white/5 bg-surface text-foreground shadow-2xl shadow-black/50 overflow-hidden"
      >
        {/* Top gold/blue gradient bar — echoes <PageHero> aesthetic without
         *  the full hero block. The same horizontal motion-feel comes from
         *  the layered radial blends. */}
        <div
          aria-hidden="true"
          className="h-1.5 w-full"
          style={{
            background:
              `linear-gradient(90deg, ${SHORTSTACK_GOLD} 0%, #93C5FD 60%, ${SHORTSTACK_GOLD} 100%)`,
          }}
        />

        {/* Header row: ShortStack mark left, close (X) right. */}
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            <Logo size={20} variant="gold" />
            <span>{BRAND.company_name}</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="rounded-md p-1 text-muted hover:text-foreground hover:bg-surface-light transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pt-4 pb-6">
          {/* Centered integration logo / avatar */}
          <div className="flex justify-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center bg-surface-light border border-border/40 overflow-hidden"
              style={{
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.05) inset, 0 4px 16px -4px rgba(0,0,0,0.45)",
              }}
            >
              {logoUrl ? (
                // unoptimized: integration logos come from arbitrary CDNs
                // (each provider hosts its own brand assets). Whitelisting
                // every host in next.config.mjs would be ceremony for a tiny
                // image. The CLAUDE.md "no <img>" rule is satisfied — we're
                // still using the modern component, just skipping the
                // image-optimization layer.
                <Image
                  src={logoUrl}
                  alt={`${integrationName} logo`}
                  width={48}
                  height={48}
                  unoptimized
                  className="rounded-xl object-contain"
                />
              ) : (
                <span
                  className="text-2xl font-bold"
                  style={{ color: SHORTSTACK_GOLD }}
                >
                  {integrationName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>

          <h2
            id={titleId}
            className="mt-4 text-center text-lg font-semibold tracking-tight"
          >
            {computedHeading}
          </h2>
          <p className="mt-1 text-center text-xs text-muted font-mono">
            {integrationId}
          </p>

          {description && (
            <p
              id={descId}
              className="mt-3 text-center text-sm text-muted"
            >
              {description}
            </p>
          )}

          {/* Scope checklist */}
          {scopesDescription.length > 0 && (
            <div
              id={!description ? descId : undefined}
              className="mt-5 rounded-xl border border-border/40 bg-surface-light/50 p-4"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-3">
                Permissions you&apos;re granting
              </div>
              <ul className="space-y-2">
                {scopesDescription.map((scope, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span
                      className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{
                        background: `${SHORTSTACK_GOLD}26`, // ~0.15 alpha
                        color: SHORTSTACK_GOLD,
                      }}
                      aria-hidden="true"
                    >
                      <Check size={10} strokeWidth={3} />
                    </span>
                    <span className="text-foreground/90">{scope}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Buttons */}
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-surface-light transition-colors"
            >
              Cancel
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-black transition-colors"
              style={{
                background: SHORTSTACK_GOLD,
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.3) inset, 0 4px 12px -4px rgba(201,168,76,0.6)",
              }}
            >
              Authorize
            </button>
          </div>

          <p className="mt-3 text-center text-[11px] text-muted">
            You&apos;ll be redirected to {integrationName} to confirm.
          </p>
        </div>
      </div>
    </div>
  );
}
