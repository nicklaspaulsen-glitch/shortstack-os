"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { formatRelativeTime } from "@/lib/utils";
import {
  BookOpen, Database, FileText, Search, Loader, RefreshCw,
  ExternalLink, Upload, FolderOpen
} from "lucide-react";
import toast from "react-hot-toast";

interface NotionDatabase {
  id: string;
  title: string;
  url: string;
  created_time: string;
  last_edited_time: string;
}

interface NotionPage {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, unknown>;
}

export default function NotionSyncPage() {
  useAuth();
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; url: string; object: string }>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => { fetchDatabases(); }, []);

  async function fetchDatabases() {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/notion?action=databases");
      const data = await res.json();
      if (data.connected === false) {
        setConnected(false);
      } else {
        setDatabases(data.databases || []);
      }
    } catch { setConnected(false); }
    setLoading(false);
  }

  async function fetchPages(dbId: string) {
    setSelectedDb(dbId);
    setPages([]);
    try {
      const res = await fetch(`/api/integrations/notion?action=pages&database_id=${dbId}`);
      const data = await res.json();
      setPages(data.pages || []);
    } catch { toast.error("Failed to load pages"); }
  }

  async function syncClients(dbId: string) {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_clients", database_id: dbId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Synced ${data.synced} clients to Notion!`);
        fetchPages(dbId);
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch { toast.error("Error syncing"); }
    setSyncing(false);
  }

  async function searchNotion() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/integrations/notion?action=search&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch { toast.error("Search failed"); }
    setSearching(false);
  }

  function getPageTitle(page: NotionPage): string {
    const props = page.properties || {};
    for (const key of Object.keys(props)) {
      const prop = props[key] as Record<string, unknown>;
      if (prop?.type === "title") {
        const titles = prop.title as Array<{ plain_text: string }>;
        if (titles?.[0]?.plain_text) return titles[0].plain_text;
      }
    }
    return "Untitled";
  }

  if (!connected && !loading) {
    return (
      <div className="fade-in space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-foreground/10 rounded-xl flex items-center justify-center">
            <BookOpen size={20} className="text-foreground" />
          </div>
          <div>
            <h1 className="page-header mb-0">Notion Sync</h1>
            <p className="text-xs text-muted">Sync databases and pages with Notion</p>
          </div>
        </div>
        <div className="card p-8 text-center">
          <BookOpen size={32} className="text-muted/30 mx-auto mb-3" />
          <h2 className="text-sm font-semibold mb-1">Notion Not Connected</h2>
          <p className="text-xs text-muted mb-3">Add your Notion internal integration token:</p>
          <code className="text-[10px] bg-surface-light rounded-lg p-3 block text-muted">NOTION_API_KEY</code>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-foreground/10 rounded-xl flex items-center justify-center">
            <BookOpen size={20} className="text-foreground" />
          </div>
          <div>
            <h1 className="page-header mb-0">Notion Sync</h1>
            <p className="text-xs text-muted">Browse databases, sync clients, search content</p>
          </div>
        </div>
        <button onClick={fetchDatabases} className="btn-secondary text-xs flex items-center gap-1.5">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="card p-3">
        <form onSubmit={e => { e.preventDefault(); searchNotion(); }} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Notion..." className="input w-full pl-9 text-xs" />
          </div>
          <button type="submit" disabled={searching} className="btn-primary text-xs px-3">
            {searching ? <Loader size={12} className="animate-spin" /> : "Search"}
          </button>
        </form>
        {searchResults.length > 0 && (
          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {searchResults.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noopener"
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-light text-xs text-muted hover:text-foreground">
                {r.object === "database" ? <Database size={12} /> : <FileText size={12} />}
                <span className="truncate">{r.id}</span>
                <ExternalLink size={10} className="shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader size={20} className="animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Databases */}
          <div className="space-y-2">
            <h2 className="section-header flex items-center gap-2"><Database size={14} className="text-gold" /> Databases</h2>
            {databases.length === 0 ? (
              <div className="card p-6 text-center text-muted text-xs">No databases found. Share databases with your Notion integration.</div>
            ) : (
              databases.map(db => (
                <button key={db.id} onClick={() => fetchPages(db.id)}
                  className={`card p-3 w-full text-left transition-all ${selectedDb === db.id ? "border-gold/30 bg-gold/[0.03]" : "hover:border-border-light"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">{db.title}</p>
                      <p className="text-[9px] text-muted mt-0.5">Edited {formatRelativeTime(db.last_edited_time)}</p>
                    </div>
                    <FolderOpen size={14} className={selectedDb === db.id ? "text-gold" : "text-muted"} />
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Pages */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="section-header flex items-center gap-2"><FileText size={14} className="text-info" /> Pages</h2>
              {selectedDb && (
                <button onClick={() => syncClients(selectedDb)} disabled={syncing}
                  className="btn-primary text-[10px] px-2.5 py-1 flex items-center gap-1">
                  {syncing ? <Loader size={10} className="animate-spin" /> : <Upload size={10} />}
                  Sync Clients Here
                </button>
              )}
            </div>
            {!selectedDb ? (
              <div className="card p-8 text-center text-muted text-xs">Select a database to view pages</div>
            ) : pages.length === 0 ? (
              <div className="card p-8 text-center text-muted text-xs">No pages in this database. Use &ldquo;Sync Clients&rdquo; to populate it.</div>
            ) : (
              <div className="space-y-1.5">
                {pages.map(page => (
                  <a key={page.id} href={page.url} target="_blank" rel="noopener"
                    className="card p-3 flex items-center justify-between hover:border-border-light transition-all group">
                    <div>
                      <p className="text-xs font-medium group-hover:text-gold transition-colors">{getPageTitle(page)}</p>
                      <p className="text-[9px] text-muted mt-0.5">Edited {formatRelativeTime(page.last_edited_time)}</p>
                    </div>
                    <ExternalLink size={12} className="text-muted group-hover:text-gold" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
