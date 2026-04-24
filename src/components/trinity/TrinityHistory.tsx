"use client";

/**
 * TrinityHistory — the scrolling conversation thread. Lives in its own
 * lazy chunk so the chat thread renderer (which pulls in
 * whitespace-preserving markdown-ish formatting) only ships once the
 * user has started a conversation.
 */

import { useEffect, useRef } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import type { ChatMsg } from "./types";

interface Props {
  messages: ChatMsg[];
  sending: boolean;
}

export default function TrinityHistory({ messages, sending }: Props) {
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll thread on new messages. Scroll the thread container only,
  // not the document — otherwise the whole page jumps when a new message
  // arrives or while the user is typing.
  useEffect(() => {
    const end = threadEndRef.current;
    const container = end?.parentElement;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, sending]);

  return (
    <div className="relative px-4 sm:px-6 pb-3 max-h-[360px] overflow-y-auto space-y-3">
      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-gold/15 text-foreground border border-gold/25 rounded-br-sm"
                : "bg-surface-light text-foreground border border-border rounded-bl-sm"
            }`}
          >
            {m.content}
            {m.actions && m.actions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/60 space-y-1">
                {m.actions.map((a, j) => (
                  <div key={j} className="flex items-center gap-1.5 text-[10px] text-muted">
                    {a.ok ? (
                      <CheckCircle size={10} className="text-success" />
                    ) : (
                      <XCircle size={10} className="text-danger" />
                    )}
                    <span className="font-mono">{a.tool}</span>
                    {a.error && <span className="text-danger">— {a.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      {sending && (
        <div className="flex justify-start">
          <div className="bg-surface-light border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )}
      <div ref={threadEndRef} />
    </div>
  );
}
