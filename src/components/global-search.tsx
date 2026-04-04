"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Zap, Users, Briefcase, Film, Bot } from "lucide-react";

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  lead: <Zap size={14} className="text-gold" />,
  client: <Users size={14} className="text-info" />,
  deal: <Briefcase size={14} className="text-success" />,
  content: <Film size={14} className="text-warning" />,
  team: <Users size={14} className="text-muted" />,
  action: <Bot size={14} className="text-gold" />,
};

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  if (!isOpen) {
    return (
      <button
        onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
        className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-muted hover:border-gold/30 transition-colors"
      >
        <Search size={14} />
        <span>Search...</span>
        <kbd className="text-xs bg-surface-light px-1.5 py-0.5 rounded">Ctrl+K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-xl mx-4 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads, clients, content, team..."
            className="flex-1 bg-transparent text-white placeholder-muted outline-none"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted hover:text-white">
              <X size={16} />
            </button>
          )}
          <kbd className="text-xs text-muted bg-surface-light px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={`${r.type}-${r.id}-${i}`}
                onClick={() => { router.push(r.href); setIsOpen(false); setQuery(""); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-light transition-colors text-left border-b border-border/30 last:border-0"
              >
                {typeIcons[r.type] || <Search size={14} />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted truncate">{r.subtitle}</p>
                </div>
                <span className="text-xs text-muted capitalize bg-surface-light px-2 py-0.5 rounded">{r.type}</span>
              </button>
            ))}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && !loading && (
          <div className="px-4 py-8 text-center text-muted text-sm">No results found</div>
        )}

        {loading && (
          <div className="px-4 py-6 text-center">
            <div className="w-5 h-5 border-2 border-gold/20 border-t-gold rounded-full animate-spin mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
}
