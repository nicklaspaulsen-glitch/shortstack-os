"use client";

import { useState } from "react";
import { Search, Zap, Plus, X, Play, Download, Filter, Globe, MapPin, Tag, Hash } from "lucide-react";
import StatusBadge from "@/components/ui/status-badge";
import DataTable from "@/components/ui/data-table";
import toast from "react-hot-toast";

const PLATFORMS = [
  { id: "google_maps", name: "Google Maps", icon: "🗺️", description: "Business listings with ratings, phone, website" },
  { id: "facebook", name: "Facebook Pages", icon: "📘", description: "Business pages with phone, address, website" },
  { id: "linkedin", name: "LinkedIn", icon: "💼", description: "Company profiles (coming soon)", disabled: true },
  { id: "yelp", name: "Yelp", icon: "⭐", description: "Reviews and local businesses (coming soon)", disabled: true },
  { id: "yellow_pages", name: "Yellow Pages", icon: "📒", description: "Directory listings (coming soon)", disabled: true },
];

const PRESET_NICHES = [
  "Plumber", "Dentist", "Lawyer", "Gym", "Electrician", "Roofer",
  "Accountant", "Chiropractor", "Real Estate Agent", "Restaurant",
  "Hair Salon", "Auto Repair", "HVAC", "Landscaper", "Photographer",
  "Pet Groomer", "Yoga Studio", "Tattoo Shop", "Bakery", "Car Wash",
  "Insurance Agent", "Financial Advisor", "Wedding Planner", "Daycare",
  "Veterinarian", "Physical Therapist", "Optometrist", "Dermatologist",
];

const PRESET_LOCATIONS = [
  "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX",
  "Phoenix, AZ", "Philadelphia, PA", "San Antonio, TX", "San Diego, CA",
  "Dallas, TX", "Austin, TX", "Denver, CO", "Miami, FL",
  "Atlanta, GA", "Seattle, WA", "Portland, OR", "Nashville, TN",
  "Boston, MA", "Las Vegas, NV", "San Francisco, CA", "Minneapolis, MN",
];

interface ScrapedLead {
  business_name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  google_rating: number | null;
  review_count: number;
  industry: string;
  source: string;
  status: string;
}

export default function ScraperPage() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["google_maps"]);
  const [niches, setNiches] = useState<string[]>(["Dentist"]);
  const [customNiche, setCustomNiche] = useState("");
  const [locations, setLocations] = useState<string[]>(["New York, NY"]);
  const [customLocation, setCustomLocation] = useState("");
  const [maxResults, setMaxResults] = useState(20);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [filters, setFilters] = useState({
    require_phone: true,
    require_website: false,
    min_rating: 0,
    max_reviews: 500,
    min_reviews: 0,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ScrapedLead[]>([]);
  const [stats, setStats] = useState({ scraped: 0, skipped: 0 });

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const addNiche = (n: string) => {
    if (n && !niches.includes(n)) setNiches([...niches, n]);
    setCustomNiche("");
  };

  const addLocation = (l: string) => {
    if (l && !locations.includes(l)) setLocations([...locations, l]);
    setCustomLocation("");
  };

  const addTag = (t: string) => {
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setCustomTag("");
  };

  async function runScraper() {
    if (selectedPlatforms.length === 0) { toast.error("Select at least one platform"); return; }
    if (niches.length === 0) { toast.error("Add at least one niche"); return; }
    if (locations.length === 0) { toast.error("Add at least one location"); return; }

    setRunning(true);
    setResults([]);
    toast.loading(`Scraping ${niches.length} niches across ${locations.length} locations...`);

    try {
      const res = await fetch("/api/scraper/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: selectedPlatforms,
          niches: niches.map(n => n.toLowerCase()),
          locations,
          max_results_per_search: maxResults,
          filters,
          tags,
        }),
      });
      toast.dismiss();
      const data = await res.json();

      if (data.success) {
        setResults(data.results || []);
        setStats({ scraped: data.totalScraped, skipped: data.totalSkipped });
        toast.success(`Found ${data.totalScraped} leads! (${data.totalSkipped} duplicates skipped)`);
      } else {
        toast.error("Scraper failed");
      }
    } catch {
      toast.dismiss();
      toast.error("Error running scraper");
    }
    setRunning(false);
  }

  const estimatedLeads = selectedPlatforms.length * niches.length * locations.length * maxResults;

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
              <Search size={24} className="text-gold" />
            </div>
            Lead Finder
          </h1>
          <p className="text-muted text-sm mt-1">Find leads from any platform, any niche, any location</p>
        </div>
        <button onClick={runScraper} disabled={running}
          className="btn-primary flex items-center gap-2 disabled:opacity-50 px-6">
          {running ? (
            <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Scraping...</>
          ) : (
            <><Play size={16} /> Run Scraper</>
          )}
        </button>
      </div>

      {/* Estimated output */}
      <div className="bg-gold/5 border border-gold/20 rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-sm">Estimated output: <span className="text-gold font-bold">{estimatedLeads.toLocaleString()} leads</span></span>
        <span className="text-xs text-muted">{selectedPlatforms.length} platform(s) × {niches.length} niche(s) × {locations.length} location(s) × {maxResults} per search</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Platform + Filters */}
        <div className="space-y-4">
          {/* Platforms */}
          <div className="card">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Globe size={14} className="text-gold" /> Platforms</h3>
            <div className="space-y-2">
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => !p.disabled && togglePlatform(p.id)} disabled={p.disabled}
                  className={`w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${
                    selectedPlatforms.includes(p.id) ? "border-gold bg-gold/10" : p.disabled ? "border-border opacity-30 cursor-not-allowed" : "border-border hover:border-gold/30"
                  }`}>
                  <span className="text-lg">{p.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-[10px] text-muted">{p.description}</p>
                  </div>
                  {selectedPlatforms.includes(p.id) && <div className="w-3 h-3 bg-gold rounded-full" />}
                </button>
              ))}
            </div>
          </div>

          {/* Results per search */}
          <div className="card">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Hash size={14} className="text-gold" /> Results per search</h3>
            <input type="range" min="5" max="60" value={maxResults} onChange={e => setMaxResults(parseInt(e.target.value))}
              className="w-full accent-gold" />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>5</span>
              <span className="text-gold font-bold">{maxResults}</span>
              <span>60</span>
            </div>
          </div>

          {/* Filters */}
          <div className="card">
            <button onClick={() => setShowFilters(!showFilters)} className="w-full flex items-center justify-between">
              <h3 className="text-sm font-medium flex items-center gap-2"><Filter size={14} className="text-gold" /> Filters</h3>
              <span className="text-xs text-muted">{showFilters ? "Hide" : "Show"}</span>
            </button>
            {showFilters && (
              <div className="space-y-3 mt-3 pt-3 border-t border-border/50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={filters.require_phone} onChange={e => setFilters({ ...filters, require_phone: e.target.checked })} className="accent-gold" />
                  <span className="text-sm">Must have phone number</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={filters.require_website} onChange={e => setFilters({ ...filters, require_website: e.target.checked })} className="accent-gold" />
                  <span className="text-sm">Must have website</span>
                </label>
                <div>
                  <span className="text-xs text-muted">Min rating: {filters.min_rating}</span>
                  <input type="range" min="0" max="5" step="0.5" value={filters.min_rating} onChange={e => setFilters({ ...filters, min_rating: parseFloat(e.target.value) })} className="w-full accent-gold" />
                </div>
                <div>
                  <span className="text-xs text-muted">Max reviews: {filters.max_reviews}</span>
                  <input type="range" min="10" max="1000" step="10" value={filters.max_reviews} onChange={e => setFilters({ ...filters, max_reviews: parseInt(e.target.value) })} className="w-full accent-gold" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Middle column — Niches */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Zap size={14} className="text-gold" /> Niches / Industries</h3>

            {/* Selected niches */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {niches.map(n => (
                <span key={n} className="bg-gold/10 border border-gold/20 text-gold text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  {n}
                  <button onClick={() => setNiches(niches.filter(x => x !== n))} className="hover:text-white"><X size={10} /></button>
                </span>
              ))}
            </div>

            {/* Add custom niche */}
            <div className="flex gap-2 mb-3">
              <input value={customNiche} onChange={e => setCustomNiche(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addNiche(customNiche)}
                placeholder="Type custom niche..."
                className="input flex-1 text-sm py-1.5" />
              <button onClick={() => addNiche(customNiche)} className="btn-secondary text-xs py-1.5 px-3"><Plus size={12} /></button>
            </div>

            {/* Preset niches */}
            <div className="flex flex-wrap gap-1">
              {PRESET_NICHES.filter(n => !niches.includes(n)).map(n => (
                <button key={n} onClick={() => addNiche(n)}
                  className="text-[10px] bg-surface-light px-2 py-1 rounded text-muted hover:text-white hover:bg-border transition-colors">
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="card">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Tag size={14} className="text-gold" /> Tags (optional)</h3>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(t => (
                <span key={t} className="bg-info/10 text-info text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                  {t} <button onClick={() => setTags(tags.filter(x => x !== t))}><X size={10} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={customTag} onChange={e => setCustomTag(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTag(customTag)}
                placeholder="Add tag..." className="input flex-1 text-sm py-1.5" />
              <button onClick={() => addTag(customTag)} className="btn-secondary text-xs py-1.5 px-3"><Plus size={12} /></button>
            </div>
          </div>
        </div>

        {/* Right column — Locations */}
        <div className="card">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><MapPin size={14} className="text-gold" /> Locations</h3>

          {/* Selected locations */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {locations.map(l => (
              <span key={l} className="bg-success/10 border border-success/20 text-success text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
                {l}
                <button onClick={() => setLocations(locations.filter(x => x !== l))} className="hover:text-white"><X size={10} /></button>
              </span>
            ))}
          </div>

          {/* Add custom location */}
          <div className="flex gap-2 mb-3">
            <input value={customLocation} onChange={e => setCustomLocation(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addLocation(customLocation)}
              placeholder="City, State or Country..."
              className="input flex-1 text-sm py-1.5" />
            <button onClick={() => addLocation(customLocation)} className="btn-secondary text-xs py-1.5 px-3"><Plus size={12} /></button>
          </div>

          {/* Preset locations */}
          <div className="flex flex-wrap gap-1 max-h-60 overflow-y-auto">
            {PRESET_LOCATIONS.filter(l => !locations.includes(l)).map(l => (
              <button key={l} onClick={() => addLocation(l)}
                className="text-[10px] bg-surface-light px-2 py-1 rounded text-muted hover:text-white hover:bg-border transition-colors">
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {(results.length > 0 || stats.scraped > 0) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gold">{stats.scraped}</p>
                <p className="text-[10px] text-muted">Leads Found</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-muted">{stats.skipped}</p>
                <p className="text-[10px] text-muted">Duplicates</p>
              </div>
            </div>
            <button onClick={() => {
              const csv = "Business,Phone,Email,Website,Address,Rating,Reviews,Industry,Source\n" +
                results.map(r => `"${r.business_name}","${r.phone || ""}","${r.email || ""}","${r.website || ""}","${r.address || ""}",${r.google_rating || ""},${r.review_count},"${r.industry}","${r.source}"`).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "leads.csv"; a.click();
            }} className="btn-secondary flex items-center gap-2 text-xs">
              <Download size={14} /> Export CSV
            </button>
          </div>

          <DataTable
            columns={[
              { key: "business_name", label: "Business", render: (r: ScrapedLead) => (
                <div>
                  <p className="font-medium text-sm">{r.business_name}</p>
                  <p className="text-[10px] text-muted">{r.industry}</p>
                </div>
              )},
              { key: "phone", label: "Phone", render: (r: ScrapedLead) => r.phone || <span className="text-muted">-</span> },
              { key: "email", label: "Email", render: (r: ScrapedLead) => r.email || <span className="text-muted">-</span> },
              { key: "website", label: "Website", render: (r: ScrapedLead) => r.website ? (
                <a href={r.website} target="_blank" rel="noopener" className="text-gold text-xs">Visit</a>
              ) : <span className="text-muted">-</span> },
              { key: "google_rating", label: "Rating", render: (r: ScrapedLead) => r.google_rating ? (
                <span className="text-xs">⭐ {r.google_rating} ({r.review_count})</span>
              ) : <span className="text-muted">-</span> },
              { key: "source", label: "Source", render: (r: ScrapedLead) => <StatusBadge status={r.source} /> },
            ]}
            data={results}
            emptyMessage="No results yet. Configure and run the scraper."
          />
        </div>
      )}
    </div>
  );
}
