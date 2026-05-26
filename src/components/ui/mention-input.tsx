"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AGENTS } from "@/lib/pixel-office/agents";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Mentionable {
  handle: string; // agent key, e.g. "echo"
  name: string; // display name, e.g. "Echo"
  role: string; // e.g. "Voice Receptionist"
  color: string; // hex color for chip, e.g. "#5E5BFF"
}

// Derive roster from the central AGENTS definition so it never drifts.
export const AGENT_ROSTER: Mentionable[] = AGENTS.map((a) => ({
  handle: a.key,
  name: a.name,
  role: a.role,
  color: `#${a.brandColor.toString(16).padStart(6, "0")}`,
}));

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Parses a plain-text value and returns found mention handles. */
export function parseMentions(value: string): string[] {
  const matches = value.match(/@([a-z0-9_-]+)/gi) ?? [];
  return matches.map((m) => m.slice(1).toLowerCase());
}

// ── MentionText ───────────────────────────────────────────────────────────────
// Renders stored plain text with colored inline chips for @handles.

interface MentionTextProps {
  value: string;
  className?: string;
}

export function MentionText({ value, className }: MentionTextProps) {
  const rosterMap = new Map(AGENT_ROSTER.map((a) => [a.handle, a]));
  const parts = value.split(/(@[a-z0-9_-]+)/gi);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const handle = part.slice(1).toLowerCase();
          const agent = rosterMap.get(handle);
          if (agent) {
            return (
              <span
                key={i}
                className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[11px] font-semibold leading-5"
                style={{
                  background: `${agent.color}22`,
                  color: agent.color,
                  border: `1px solid ${agent.color}44`,
                }}
              >
                @{agent.name}
              </span>
            );
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

// ── MentionInput ──────────────────────────────────────────────────────────────

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Called for any keydown event that the mention dropdown did NOT consume. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export default function MentionInput({
  value,
  onChange,
  rows = 3,
  placeholder,
  className,
  disabled,
  onKeyDown: externalKeyDown,
}: MentionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionStartRef = useRef<number>(-1);
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = dropdownOpen
    ? AGENT_ROSTER.filter(
        (a) =>
          query === "" ||
          a.handle.startsWith(query.toLowerCase()) ||
          a.name.toLowerCase().startsWith(query.toLowerCase()),
      ).slice(0, 6)
    : [];

  const closeDropdown = useCallback(() => {
    setDropdownOpen(false);
    setQuery("");
    mentionStartRef.current = -1;
  }, []);

  const selectMention = useCallback(
    (m: Mentionable) => {
      if (!textareaRef.current) return;
      const cursor = textareaRef.current.selectionStart ?? value.length;
      const start = mentionStartRef.current >= 0 ? mentionStartRef.current : cursor;
      const before = value.slice(0, start);
      const after = value.slice(cursor);
      const token = `@${m.handle} `;
      onChange(before + token + after);
      closeDropdown();
      requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        const pos = start + token.length;
        textareaRef.current.setSelectionRange(pos, pos);
        textareaRef.current.focus();
      });
    },
    [value, onChange, closeDropdown],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    const cursor = e.target.selectionStart ?? newVal.length;
    const before = newVal.slice(0, cursor);
    const match = before.match(/@([a-z0-9_-]*)$/i);
    if (match) {
      mentionStartRef.current = before.lastIndexOf("@");
      setQuery(match[1]);
      setActiveIndex(0);
      setDropdownOpen(true);
    } else {
      if (dropdownOpen) closeDropdown();
    }
    onChange(newVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (dropdownOpen && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(filtered[activeIndex]);
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeDropdown();
        return;
      }
    }
    // Dropdown did not consume this key — delegate to the parent.
    externalKeyDown?.(e);
  };

  // Close dropdown when the user clicks outside the textarea.
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen, closeDropdown]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        aria-autocomplete="list"
        aria-expanded={dropdownOpen}
        aria-haspopup="listbox"
      />

      {dropdownOpen && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute bottom-full mb-1 left-0 w-full max-h-52 overflow-y-auto z-50 rounded-lg border border-border-subtle bg-[#0D1120] shadow-xl py-1"
        >
          {filtered.map((a, idx) => (
            <li
              key={a.handle}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                selectMention(a);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`flex items-center gap-2.5 px-3 py-1.5 cursor-pointer transition-colors ${
                idx === activeIndex ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
              }`}
            >
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold shrink-0"
                style={{
                  background: `${a.color}22`,
                  color: a.color,
                  border: `1px solid ${a.color}44`,
                }}
              >
                {a.name[0]}
              </span>
              <span className="text-sm font-medium text-text-primary">@{a.handle}</span>
              <span className="text-xs text-text-muted truncate">{a.role}</span>
            </li>
          ))}
          <li className="px-3 pt-1.5 pb-0.5">
            <p className="text-[10px] text-text-muted/60 select-none">
              ↑↓ navigate · Enter/Tab select · Esc cancel
            </p>
          </li>
        </ul>
      )}
    </div>
  );
}
