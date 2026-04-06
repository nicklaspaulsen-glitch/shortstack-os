"use client";

import { useState } from "react";
import { Search, Zap, Plus, X, Play, Download, Filter, Globe, MapPin, Tag, Hash, Map, Camera, Music, Briefcase, Star, FlaskConical, MessageCircle, Send } from "lucide-react";
import StatusBadge from "@/components/ui/status-badge";
import DataTable from "@/components/ui/data-table";
import toast from "react-hot-toast";

const PLATFORMS: Array<{ id: string; name: string; icon: React.ReactNode; description: string; disabled?: boolean }> = [
  { id: "google_maps", name: "Google Maps", icon: <Map size={18} className="text-accent" />, description: "Business listings with ratings, phone, website" },
  { id: "facebook", name: "Facebook Pages", icon: <MessageCircle size={18} className="text-info" />, description: "Business pages with phone, email, followers" },
  { id: "instagram", name: "Instagram", icon: <Camera size={18} className="text-danger-light" />, description: "Find businesses by hashtag, niche, or location" },
  { id: "tiktok", name: "TikTok", icon: <Music size={18} className="text-white" />, description: "Find businesses with TikTok profiles" },
  { id: "linkedin", name: "LinkedIn", icon: <Briefcase size={18} className="text-info-light" />, description: "Company profiles from website enrichment" },
  { id: "yelp", name: "Yelp", icon: <Star size={18} className="text-warning" />, description: "Reviews and local businesses (needs API key)", disabled: true },
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
  lead_score?: number;
  instagram_url?: string;
  facebook_url?: string;
  tiktok_url?: string;
  linkedin_url?: string;
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
  const [testRunning, setTestRunning] = useState(false);
  const [results, setResults] = useState<ScrapedLead[]>([]);
  const [stats, setStats] = useState({ scraped: 0, skipped: 0 });
  const [testResults, setTestResults] = useState<{ totalFound: number; totalSaved: number; totalSkipped: number; errors: string[]; breakdown: Array<{ niche: string; city: string; found: number; saved: number; skipped: number }> } | null>(null);

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

    const socialPlatforms = selectedPlatforms.filter(p => ["instagram", "facebook", "tiktok", "linkedin"].includes(p));
    const mapPlatforms = selectedPlatforms.filter(p => ["google_maps", "yelp"].includes(p));

    toast.loading(`Scraping ${selectedPlatforms.length} platforms × ${niches.length} niches...`);

    try {
      const allResults: ScrapedLead[] = [];
      let totalScraped = 0;
      let totalSkipped = 0;

      // Run Google Maps / Yelp scraper
      if (mapPlatforms.length > 0) {
        const res = await fetch("/api/scraper/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platforms: mapPlatforms,
            niches: niches.map(n => n.toLowerCase()),
            locations,
            max_results_per_search: maxResults,
            filters,
            tags,
          }),
        });
        const data = await res.json();
        if (data.success) {
          allResults.push(...(data.results || []));
          totalScraped += data.totalScraped || 0;
          totalSkipped += data.totalSkipped || 0;
        }
      }

      // Run social media scraper
      if (socialPlatforms.length > 0) {
        for (const niche of niches) {
          const res = await fetch("/api/scraper/social", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platform: socialPlatforms.length === 1 ? socialPlatforms[0] : "all",
              search_type: tags.length > 0 ? "hashtag" : "niche",
              query: niche.toLowerCase(),
              niche: niche.toLowerCase(),
              location: locations[0],
              hashtags: tags.length > 0 ? tags.map(t => t.startsWith("#") ? t : `#${t}`) : undefined,
              max_leads: maxResults,
              auto_score: true,
              filters,
            }),
          });
          const data = await res.json();
          if (data.success) {
            const mapped = (data.leads || []).map((l: Record<string, unknown>) => ({
              business_name: l.business_name || l.instagram_handle || "",
              phone: l.phone || null,
              email: l.email || null,
              website: l.website || null,
              address: l.address || null,
              google_rating: l.rating || null,
              review_count: (l.review_count as number) || (l.followers as number) || 0,
              industry: l.industry || niche,
              source: l.source || "social",
              status: l.qualification || "new",
              lead_score: l.lead_score,
              instagram_url: l.instagram_url,
              facebook_url: l.facebook_url,
              tiktok_url: l.tiktok_url,
              linkedin_url: l.linkedin_url,
            }));
            allResults.push(...mapped);
            totalScraped += data.saved_to_db || 0;
          }
        }
      }

      toast.dismiss();

      if (allResults.length > 0) {
        // Sort by lead score if available
        allResults.sort((a, b) => ((b.lead_score || 0) - (a.lead_score || 0)));
        setResults(allResults);
        setStats({ scraped: totalScraped, skipped: totalSkipped });
        toast.success(`Found ${allResults.length} leads! (${totalScraped} saved, ${totalSkipped} duplicates)`);
      } else {
        toast.error("No leads found — try different niches or locations");
      }
    } catch {
      toast.dismiss();
      toast.error("Error running scraper");
    }
    setRunning(false);
  }

  async function runTest500() {
    setTestRunning(true);
    setTestResults(null);
    toast.loading("Running 500-lead test... (10 niches x 5 cities)");
    try {
      const res = await fetch("/api/scraper/test-500", { method: "POST" });
      toast.dismiss();
      const data = await res.json();
      if (data.success) {
        setTestResults(data);
        toast.success(`Test complete: ${data.totalSaved} leads saved`);
      } else {
        toast.error(data.error || "Test failed");
      }
    } catch {
      toast.dismiss();
      toast.error("Test run failed");
    }
    setTestRunning(false);
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
        <div className="flex items-center gap-2">
          <button onClick={runTest500} disabled={testRunning || running}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50 text-xs">
            {testRunning ? (
              <><div className="w-3 h-3 border-2 border-muted/20 border-t-muted rounded-full animate-spin" /> Testing...</>
            ) : (
              <><FlaskConical size={14} /> Test 500</>
            )}
          </button>
          <button onClick={runScraper} disabled={running}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 px-5">
            {running ? (
              <><div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Scraping...</>
            ) : (
              <><Play size={14} /> Run Scraper</>
            )}
          </button>
        </div>
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
                  <span className="shrink-0">{p.icon}</span>
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
            <input type="range" min="5" max="500" value={maxResults} onChange={e => setMaxResults(parseInt(e.target.value))}
              className="w-full accent-gold" />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>5</span>
              <span className="text-gold font-bold">{maxResults}</span>
              <span>500</span>
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
            <div className="flex items-center gap-1.5">
              {/* CSV Export */}
              <button onClick={() => {
                const csv = "Business,Phone,Email,Website,Address,Rating,Reviews,Industry,Source\n" +
                  results.map(r => `"${r.business_name}","${r.phone || ""}","${r.email || ""}","${r.website || ""}","${r.address || ""}",${r.google_rating || ""},${r.review_count},"${r.industry}","${r.source}"`).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "leads.csv"; a.click();
                toast.success("CSV downloaded");
              }} className="btn-secondary flex items-center gap-1.5 text-[10px] py-1.5">
                <Download size={12} /> CSV
              </button>

              {/* JSON Export */}
              <button onClick={() => {
                const json = JSON.stringify(results, null, 2);
                const blob = new Blob([json], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "leads.json"; a.click();
                toast.success("JSON downloaded");
              }} className="btn-secondary flex items-center gap-1.5 text-[10px] py-1.5">
                <Download size={12} /> JSON
              </button>

              {/* Excel-compatible Export */}
              <button onClick={() => {
                const header = "Business\tPhone\tEmail\tWebsite\tAddress\tRating\tReviews\tIndustry\tSource\n";
                const rows = results.map(r => `${r.business_name}\t${r.phone || ""}\t${r.email || ""}\t${r.website || ""}\t${r.address || ""}\t${r.google_rating || ""}\t${r.review_count}\t${r.industry}\t${r.source}`).join("\n");
                const blob = new Blob([header + rows], { type: "text/tab-separated-values" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "leads.xlsx"; a.click();
                toast.success("Excel file downloaded");
              }} className="btn-secondary flex items-center gap-1.5 text-[10px] py-1.5">
                <Download size={12} /> Excel
              </button>

              {/* Push to GHL */}
              <button onClick={async () => {
                toast.loading("Syncing to GoHighLevel...");
                try {
                  const res = await fetch("/api/ghl/sync-leads", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ leads: results.slice(0, 100) }),
                  });
                  toast.dismiss();
                  const data = await res.json();
                  if (data.success) {
                    toast.success(`${data.synced} leads synced to GHL!`);
                  } else {
                    toast.error(data.error || "GHL sync failed");
                  }
                } catch {
                  toast.dismiss();
                  toast.error("Failed to sync with GHL");
                }
              }} className="btn-primary flex items-center gap-1.5 text-[10px] py-1.5">
                <Send size={12} /> Push to GHL
              </button>
            </div>
          </div>

          <DataTable
            columns={[
              { key: "lead_score", label: "Score", render: (r: any) => {
                const score = r.lead_score as number;
                if (!score) return <span className="text-muted text-xs">-</span>;
                return (
                  <div className="text-center">
                    <span className={`text-sm font-bold ${score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-muted"}`}>{score}</span>
                    <p className={`text-[9px] ${score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-muted"}`}>
                      {score >= 70 ? "HOT" : score >= 40 ? "WARM" : "COLD"}
                    </p>
                  </div>
                );
              }},
              { key: "business_name", label: "Business", render: (r: ScrapedLead) => (
                <div>
                  <p className="font-medium text-sm">{r.business_name}</p>
                  <p className="text-[10px] text-muted">{r.industry}</p>
                </div>
              )},
              { key: "phone", label: "Phone", render: (r: ScrapedLead) => r.phone ? (
                <a href={`tel:${r.phone}`} className="text-gold text-xs">{r.phone}</a>
              ) : <span className="text-muted text-xs">-</span> },
              { key: "email", label: "Email", render: (r: ScrapedLead) => r.email ? (
                <span className="text-xs text-gold">{r.email}</span>
              ) : <span className="text-muted text-xs">-</span> },
              { key: "socials", label: "Socials", render: (r: any) => (
                <div className="flex gap-1">
                  {r.instagram_url && <a href={r.instagram_url as string} target="_blank" rel="noopener" className="text-[10px] bg-pink-500/10 text-pink-400 px-1.5 py-0.5 rounded">IG</a>}
                  {r.facebook_url && <a href={r.facebook_url as string} target="_blank" rel="noopener" className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">FB</a>}
                  {r.tiktok_url && <a href={r.tiktok_url as string} target="_blank" rel="noopener" className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded">TK</a>}
                  {r.linkedin_url && <a href={r.linkedin_url as string} target="_blank" rel="noopener" className="text-[10px] bg-blue-400/10 text-blue-300 px-1.5 py-0.5 rounded">LI</a>}
                  {!r.instagram_url && !r.facebook_url && !r.tiktok_url && !r.linkedin_url && <span className="text-muted text-[10px]">None</span>}
                </div>
              )},
              { key: "website", label: "Website", render: (r: ScrapedLead) => r.website ? (
                <a href={r.website} target="_blank" rel="noopener" className="text-gold text-xs">Visit</a>
              ) : <span className="text-muted text-xs">-</span> },
              { key: "google_rating", label: "Rating", render: (r: ScrapedLead) => r.google_rating ? (
                <span className="text-xs flex items-center gap-1"><Star size={10} className="text-warning fill-warning" /> {r.google_rating} ({r.review_count})</span>
              ) : r.review_count > 0 ? (
                <span className="text-xs">{r.review_count} followers</span>
              ) : <span className="text-muted text-xs">-</span> },
              { key: "source", label: "Source", render: (r: ScrapedLead) => <StatusBadge status={r.source} /> },
            ]}
            data={results}
            emptyMessage="No results yet. Configure and run the scraper."
          />
        </div>
      )}
      {/* Test 500 Results */}
      {testResults && (
        <div className="space-y-4">
          <div className="card border-accent/20">
            <h3 className="section-header flex items-center gap-2">
              <FlaskConical size={14} className="text-accent" /> 500-Lead Test Results
            </h3>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="text-center p-2.5 bg-surface-light/50 rounded-lg border border-border/20">
                <p className="text-lg font-bold font-mono text-accent">{testResults.totalFound}</p>
                <p className="text-[9px] text-muted uppercase tracking-wider">Found</p>
              </div>
              <div className="text-center p-2.5 bg-surface-light/50 rounded-lg border border-border/20">
                <p className="text-lg font-bold font-mono text-success">{testResults.totalSaved}</p>
                <p className="text-[9px] text-muted uppercase tracking-wider">Saved</p>
              </div>
              <div className="text-center p-2.5 bg-surface-light/50 rounded-lg border border-border/20">
                <p className="text-lg font-bold font-mono text-warning">{testResults.totalSkipped}</p>
                <p className="text-[9px] text-muted uppercase tracking-wider">Duplicates</p>
              </div>
              <div className="text-center p-2.5 bg-surface-light/50 rounded-lg border border-border/20">
                <p className="text-lg font-bold font-mono text-danger">{testResults.errors.length}</p>
                <p className="text-[9px] text-muted uppercase tracking-wider">Errors</p>
              </div>
            </div>

            {/* Breakdown by niche/city */}
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Niche</th>
                    <th>City</th>
                    <th>Found</th>
                    <th>Saved</th>
                    <th>Skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.breakdown.map((r, i) => (
                    <tr key={i}>
                      <td className="text-xs font-medium capitalize">{r.niche}</td>
                      <td className="text-xs text-muted">{r.city}</td>
                      <td className="text-xs font-mono">{r.found}</td>
                      <td className="text-xs font-mono text-success">{r.saved}</td>
                      <td className="text-xs font-mono text-muted">{r.skipped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {testResults.errors.length > 0 && (
              <div className="mt-3 p-2.5 bg-danger/5 border border-danger/10 rounded-lg">
                <p className="text-[10px] text-danger font-medium mb-1">Errors:</p>
                {testResults.errors.map((e, i) => (
                  <p key={i} className="text-[10px] text-danger/80">{e}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
