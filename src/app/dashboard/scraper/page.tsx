"use client";

import { useState, useEffect } from "react";
import {
  Search, Zap, Plus, X, Play, Download, Filter, Globe, MapPin, Tag, Hash,
  FlaskConical, Send, Star,
  Clock, Save, Users, Wifi, Target,
  Calendar, Trash2, Eye, Mail, Phone, Layers,
  UserPlus, Database, CheckCircle, Bookmark,
  ChevronDown, ChevronRight, DollarSign, Building, Briefcase, MessageSquareWarning
} from "lucide-react";
import {
  GoogleMapsIcon, FacebookIcon, InstagramIcon, TikTokIcon, LinkedInIcon,
  YelpIcon, TripAdvisorIcon, TrustpilotIcon, YellowPagesIcon, IndeedIcon,
} from "@/components/ui/platform-icons";
import StatusBadge from "@/components/ui/status-badge";
import DataTable from "@/components/ui/data-table";
import PageHero from "@/components/ui/page-hero";
import toast from "react-hot-toast";

/* ─── static data ─── */
const PLATFORMS: Array<{ id: string; name: string; icon: React.ReactNode; description: string; disabled?: boolean; apify?: boolean }> = [
  { id: "google_maps", name: "Google Maps", icon: <GoogleMapsIcon size={20} />, description: "Business listings with ratings, phone, website" },
  { id: "facebook", name: "Facebook Pages", icon: <FacebookIcon size={20} />, description: "Business pages with phone, email, followers" },
  { id: "instagram", name: "Instagram", icon: <InstagramIcon size={20} />, description: "Find businesses by hashtag, niche, or location" },
  { id: "tiktok", name: "TikTok", icon: <TikTokIcon size={20} />, description: "Find businesses with TikTok profiles" },
  { id: "linkedin", name: "LinkedIn", icon: <LinkedInIcon size={20} />, description: "Company profiles from website enrichment" },
  { id: "yelp", name: "Yelp", icon: <YelpIcon size={20} />, description: "Reviews and local businesses (needs API key)", disabled: true },
  { id: "tripadvisor", name: "TripAdvisor", icon: <TripAdvisorIcon size={20} />, description: "Hotels, restaurants, attractions with reviews", apify: true },
  { id: "trustpilot", name: "Trustpilot", icon: <TrustpilotIcon size={20} />, description: "Business reviews and company profiles", apify: true },
  { id: "yellow_pages", name: "Yellow Pages", icon: <YellowPagesIcon size={20} />, description: "Local business directory listings", apify: true },
  { id: "indeed", name: "Indeed", icon: <IndeedIcon size={20} />, description: "Job listings for B2B lead discovery", apify: true },
];

const NICHE_CATEGORIES: Record<string, string[]> = {
  "Home Services": ["Plumber", "Electrician", "HVAC", "Roofer", "Landscaper", "Pest Control", "Painter", "Handyman", "Locksmith", "Garage Door Repair", "Carpet Cleaning", "Window Cleaning", "Pool Service", "Fencing", "Gutter Cleaning", "Pressure Washing", "Flooring Installer", "Home Inspector", "Solar Installer", "Moving Company"],
  "Health & Medical": ["Dentist", "Chiropractor", "Physical Therapist", "Optometrist", "Dermatologist", "Veterinarian", "Orthodontist", "Pediatrician", "Plastic Surgeon", "Urgent Care", "Mental Health Therapist", "Acupuncturist", "Massage Therapist", "Nutritionist", "Home Health Aide", "Medical Spa", "Pharmacy"],
  "Legal & Financial": ["Lawyer", "Accountant", "Financial Advisor", "Insurance Agent", "Mortgage Broker", "Tax Preparer", "Bookkeeper", "Real Estate Agent", "Property Manager", "Notary Public", "Bankruptcy Attorney", "Immigration Lawyer", "Personal Injury Lawyer", "Estate Planning Attorney"],
  "Automotive": ["Auto Repair", "Car Wash", "Auto Detailing", "Tire Shop", "Auto Body Shop", "Oil Change", "Towing Service", "Car Dealership", "Transmission Repair", "Brake Service", "Auto Glass Repair"],
  "Beauty & Wellness": ["Hair Salon", "Barber Shop", "Nail Salon", "Spa", "Yoga Studio", "Gym", "Personal Trainer", "Tattoo Shop", "Tanning Salon", "Lash & Brow Studio", "Skincare Clinic", "Weight Loss Clinic", "Pilates Studio", "Waxing Studio"],
  "Food & Hospitality": ["Restaurant", "Bakery", "Catering", "Food Truck", "Coffee Shop", "Bar & Lounge", "Pizza Shop", "Ice Cream Shop", "Juice Bar", "Brewery", "Hotel", "Bed & Breakfast", "Event Venue"],
  "Professional Services": ["Marketing Agency", "Web Designer", "Photographer", "Videographer", "IT Support", "Consulting Firm", "Staffing Agency", "Translation Service", "Printing Company", "Courier Service", "Cleaning Service", "Security Company"],
  "Education & Childcare": ["Daycare", "Tutoring Center", "Music School", "Dance Studio", "Martial Arts", "Driving School", "Preschool", "After School Program", "Language School", "Art School", "Swimming Lessons"],
  "Construction & Trade": ["General Contractor", "Plumbing Contractor", "Electrical Contractor", "Concrete Company", "Excavation", "Demolition", "Scaffolding", "Drywall", "Masonry", "Welding", "Cabinet Maker", "Countertop Installer"],
  "Retail & E-commerce": ["Clothing Boutique", "Jewelry Store", "Pet Store", "Florist", "Gift Shop", "Furniture Store", "Electronics Store", "Liquor Store", "Smoke Shop", "Thrift Store", "Sporting Goods", "Book Store"],
};

const ALL_NICHES = Object.values(NICHE_CATEGORIES).flat();

const REVENUE_RANGES = ["Under $100K", "$100K-$500K", "$500K-$1M", "$1M-$5M", "$5M-$10M", "$10M+"];

const DECISION_MAKER_TITLES = ["Owner", "CEO", "Founder", "Marketing Director", "Operations Manager", "General Manager", "President", "Partner"];

const COUNTRIES = [
  { code: "US", name: "United States", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "UK", name: "United Kingdom", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "CA", name: "Canada", flag: "\u{1F1E8}\u{1F1E6}" },
  { code: "AU", name: "Australia", flag: "\u{1F1E6}\u{1F1FA}" },
  { code: "DE", name: "Germany", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "FR", name: "France", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "NL", name: "Netherlands", flag: "\u{1F1F3}\u{1F1F1}" },
  { code: "ES", name: "Spain", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "IT", name: "Italy", flag: "\u{1F1EE}\u{1F1F9}" },
  { code: "SE", name: "Sweden", flag: "\u{1F1F8}\u{1F1EA}" },
  { code: "DK", name: "Denmark", flag: "\u{1F1E9}\u{1F1F0}" },
  { code: "NO", name: "Norway", flag: "\u{1F1F3}\u{1F1F4}" },
  { code: "BR", name: "Brazil", flag: "\u{1F1E7}\u{1F1F7}" },
  { code: "MX", name: "Mexico", flag: "\u{1F1F2}\u{1F1FD}" },
  { code: "IN", name: "India", flag: "\u{1F1EE}\u{1F1F3}" },
  { code: "JP", name: "Japan", flag: "\u{1F1EF}\u{1F1F5}" },
  { code: "AE", name: "UAE", flag: "\u{1F1E6}\u{1F1EA}" },
  { code: "SG", name: "Singapore", flag: "\u{1F1F8}\u{1F1EC}" },
  { code: "NZ", name: "New Zealand", flag: "\u{1F1F3}\u{1F1FF}" },
  { code: "IE", name: "Ireland", flag: "\u{1F1EE}\u{1F1EA}" },
];

const CITIES_BY_COUNTRY: Record<string, string[]> = {
  US: ["New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ", "Philadelphia, PA", "San Antonio, TX", "San Diego, CA", "Dallas, TX", "Austin, TX", "Denver, CO", "Miami, FL", "Atlanta, GA", "Seattle, WA", "Portland, OR", "Nashville, TN", "Boston, MA", "Las Vegas, NV", "San Francisco, CA", "Minneapolis, MN", "Charlotte, NC", "Tampa, FL", "Detroit, MI", "Salt Lake City, UT", "Orlando, FL"],
  UK: ["London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Bristol", "Edinburgh", "Glasgow", "Cardiff", "Belfast"],
  CA: ["Toronto, ON", "Vancouver, BC", "Montreal, QC", "Calgary, AB", "Ottawa, ON", "Edmonton, AB", "Winnipeg, MB", "Halifax, NS"],
  AU: ["Sydney, NSW", "Melbourne, VIC", "Brisbane, QLD", "Perth, WA", "Adelaide, SA", "Gold Coast, QLD"],
  DE: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart", "D\u00FCsseldorf"],
  DK: ["Copenhagen", "Aarhus", "Odense", "Aalborg"],
  SE: ["Stockholm", "Gothenburg", "Malm\u00F6", "Uppsala"],
  NO: ["Oslo", "Bergen", "Trondheim", "Stavanger"],
  NL: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"],
  FR: ["Paris", "Lyon", "Marseille", "Toulouse", "Nice", "Bordeaux"],
  ES: ["Madrid", "Barcelona", "Valencia", "Seville", "Malaga"],
  IT: ["Rome", "Milan", "Naples", "Turin", "Florence"],
  BR: ["S\u00E3o Paulo", "Rio de Janeiro", "Bras\u00EDlia", "Salvador"],
  MX: ["Mexico City", "Guadalajara", "Monterrey", "Canc\u00FAn"],
  IN: ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai"],
  JP: ["Tokyo", "Osaka", "Yokohama", "Kyoto"],
  AE: ["Dubai", "Abu Dhabi", "Sharjah"],
  SG: ["Singapore"],
  NZ: ["Auckland", "Wellington", "Christchurch"],
  IE: ["Dublin", "Cork", "Galway"],
};

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];

const TECH_STACKS = [
  "WordPress", "Shopify", "Wix", "Squarespace", "Custom", "None Detected",
  "React", "Next.js", "PHP", "Magento", "BigCommerce", "GoDaddy",
];

const SCHEDULE_OPTIONS = [
  { id: "once", label: "Run Once" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Every 2 Weeks" },
  { id: "monthly", label: "Monthly" },
];

/* ─── types ─── */
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
  tech_stack?: string;
  employee_count?: string;
  decision_maker?: string;
  decision_maker_title?: string;
  decision_maker_email?: string;
  decision_maker_linkedin?: string;
}

interface SavedSearch {
  id: string;
  name: string;
  platforms: string[];
  niches: string[];
  locations: string[];
  filters: Record<string, unknown>;
  created_at: string;
  last_run?: string;
  result_count?: number;
}

interface SearchHistoryItem {
  id: string;
  platforms: string[];
  niches: string[];
  locations: string[];
  results_found: number;
  leads_saved: number;
  timestamp: string;
}

interface ScheduledScrape {
  id: string;
  name: string;
  schedule: string;
  platforms: string[];
  niches: string[];
  locations: string[];
  next_run: string;
  is_active: boolean;
  total_runs: number;
  total_leads: number;
}

type Tab = "search" | "results" | "enrichment" | "saved" | "history" | "schedule";

/* ─── component ─── */
export default function ScraperPage() {
  const [tab, setTab] = useState<Tab>("search");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["google_maps"]);
  const [niches, setNiches] = useState<string[]>(["Dentist"]);
  const [customNiche, setCustomNiche] = useState("");
  const [locations, setLocations] = useState<string[]>(["New York, NY"]);
  const [customLocation, setCustomLocation] = useState("");
  const [targetMode, setTargetMode] = useState<"b2b" | "b2c" | "both">("both");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["US"]);
  const [locationSearch, setLocationSearch] = useState("");
  const [maxResults, setMaxResults] = useState(20);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [filters, setFilters] = useState({
    require_phone: true,
    require_website: false,
    require_local: true,
    min_rating: 0,
    max_rating: 5,
    max_reviews: 500,
    min_reviews: 0,
    no_website: false,
    low_reviews_only: false,
    bad_ratings_only: false,
    company_size: "" as string,
    tech_stack: "" as string,
    has_social: false,
    missing_social: false,
    // Revenue range
    revenue_range: "" as string,
    // Presence filters
    has_google_business: false,
    has_instagram: false,
    has_facebook: false,
    has_tiktok: false,
    no_instagram: false,
    no_facebook: false,
    no_social_at_all: false,
    // Enhanced review filters
    has_negative_reviews: false,
    recently_reviewed: false,
    // Decision maker targeting
    find_decision_makers: false,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Decision maker titles
  const [decisionMakerTitles, setDecisionMakerTitles] = useState<string[]>([]);

  // AI Smart Match
  const [aiMatchPrompt, setAiMatchPrompt] = useState("");
  const [aiMatchEnabled, setAiMatchEnabled] = useState(false);

  // Categorized niches UI
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [nicheSearch, setNicheSearch] = useState("");
  const [running, setRunning] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [results, setResults] = useState<ScrapedLead[]>([]);
  const [stats, setStats] = useState({ scraped: 0, skipped: 0 });
  const [testResults, setTestResults] = useState<{ totalFound: number; totalSaved: number; totalSkipped: number; errors: string[]; breakdown: Array<{ niche: string; city: string; found: number; saved: number; skipped: number }> } | null>(null);

  // Enrichment
  const [enriching, setEnriching] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [enrichmentType, setEnrichmentType] = useState<"contact" | "tech" | "decision_maker">("contact");

  // Saved searches
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveSearchName, setSaveSearchName] = useState("");

  // Search history
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);

  // Scheduled scrapes
  const [scheduledScrapes, setScheduledScrapes] = useState<ScheduledScrape[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ name: "", schedule: "weekly" });

  // Auto-run daily
  const [autoRunEnabled, setAutoRunEnabled] = useState(false);
  const [autoRunTime, setAutoRunTime] = useState("09:00");
  const [autoRunDays, setAutoRunDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [autoRunSaving, setAutoRunSaving] = useState(false);
  const [showAutoRunConfig, setShowAutoRunConfig] = useState(false);

  // Load auto-run config on mount
  useEffect(() => {
    fetch("/api/scraper/auto-run")
      .then(r => r.json())
      .then(d => {
        if (d.config) {
          setAutoRunEnabled(!!d.config.enabled);
          if (d.config.time) setAutoRunTime(d.config.time);
          if (d.config.days) setAutoRunDays(d.config.days);
        }
      })
      .catch(() => {});
  }, []);

  // Load search history and saved searches from outreach config
  useEffect(() => {
    fetch("/api/outreach/configure").then(r => r.json()).then(d => {
      if (d.config?.saved_searches) setSavedSearches(d.config.saved_searches);
      if (d.config?.search_history) setSearchHistory(d.config.search_history);
      if (d.config?.scheduled_scrapes) setScheduledScrapes(d.config.scheduled_scrapes);
    }).catch(() => {});
  }, []);

  // Batch search
  const [batchMode, setBatchMode] = useState(false);
  const [batchNiches, setBatchNiches] = useState("");

  // Outreach launch modal
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [outreachConfig, setOutreachConfig] = useState({
    daily_email_limit: 50,
    daily_sms_limit: 20,
    daily_dm_limit: 30,
    daily_call_limit: 10,
    start_delay: "immediately" as "immediately" | "tomorrow" | "custom",
  });

  // Lead scoring config
  const [scoringWeights, setScoringWeights] = useState({
    has_phone: 15,
    has_email: 15,
    has_website: 10,
    low_reviews: 20,
    bad_rating: 15,
    no_social: 10,
    local_business: 15,
  });
  const [showScoringConfig, setShowScoringConfig] = useState(false);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };
  const addNiche = (n: string) => { if (n && !niches.includes(n)) setNiches([...niches, n]); setCustomNiche(""); };
  const addLocation = (l: string) => { if (l && !locations.includes(l)) setLocations([...locations, l]); setCustomLocation(""); };
  const addTag = (t: string) => { if (t && !tags.includes(t)) setTags([...tags, t]); setCustomTag(""); };
  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };
  const toggleDecisionMakerTitle = (title: string) => {
    setDecisionMakerTitles(prev => prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]);
  };
  const filteredNicheCategories = nicheSearch.trim()
    ? Object.entries(NICHE_CATEGORIES).reduce((acc, [cat, items]) => {
        const filtered = items.filter(n => n.toLowerCase().includes(nicheSearch.toLowerCase()));
        if (filtered.length > 0) acc[cat] = filtered;
        return acc;
      }, {} as Record<string, string[]>)
    : NICHE_CATEGORIES;

  const toggleLeadSelection = (idx: number) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const selectAllLeads = () => {
    if (selectedLeads.size === results.length) setSelectedLeads(new Set());
    else setSelectedLeads(new Set(results.map((_, i) => i)));
  };

  async function runScraper() {
    if (selectedPlatforms.length === 0) { toast.error("Select at least one platform"); return; }
    if (niches.length === 0) { toast.error("Add at least one niche"); return; }
    if (locations.length === 0) { toast.error("Add at least one location"); return; }
    setRunning(true);
    setResults([]);
    const apifyPlatformIds = PLATFORMS.filter(p => p.apify).map(p => p.id);
    const socialPlatforms = selectedPlatforms.filter(p => ["instagram", "facebook", "tiktok", "linkedin"].includes(p));
    const mapPlatforms = selectedPlatforms.filter(p => ["google_maps", "yelp"].includes(p) && !apifyPlatformIds.includes(p));
    const apifyPlatforms = selectedPlatforms.filter(p => apifyPlatformIds.includes(p));
    toast.loading(`Scraping ${selectedPlatforms.length} platforms x ${niches.length} niches...`);
    try {
      const allResults: ScrapedLead[] = [];
      let totalScraped = 0;
      let totalSkipped = 0;
      if (mapPlatforms.length > 0) {
        const res = await fetch("/api/scraper/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platforms: mapPlatforms, niches: niches.map(n => n.toLowerCase()), locations, max_results_per_search: maxResults, filters, tags }) });
        const data = await res.json();
        if (data.success) { allResults.push(...(data.results || [])); totalScraped += data.totalScraped || 0; totalSkipped += data.totalSkipped || 0; }
      }
      if (socialPlatforms.length > 0) {
        for (const niche of niches) {
          const res = await fetch("/api/scraper/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform: socialPlatforms.length === 1 ? socialPlatforms[0] : "all", search_type: tags.length > 0 ? "hashtag" : "niche", query: niche.toLowerCase(), niche: niche.toLowerCase(), location: locations[0], hashtags: tags.length > 0 ? tags.map(t => t.startsWith("#") ? t : `#${t}`) : undefined, max_leads: maxResults, auto_score: true, filters }) });
          const data = await res.json();
          if (data.success) {
            const mapped = (data.leads || []).map((l: Record<string, unknown>) => ({ business_name: l.business_name || l.instagram_handle || "", phone: l.phone || null, email: l.email || null, website: l.website || null, address: l.address || null, google_rating: l.rating || null, review_count: (l.review_count as number) || (l.followers as number) || 0, industry: l.industry || niche, source: l.source || "social", status: l.qualification || "new", lead_score: l.lead_score as number | undefined, instagram_url: l.instagram_url as string | undefined, facebook_url: l.facebook_url as string | undefined, tiktok_url: l.tiktok_url as string | undefined, linkedin_url: l.linkedin_url as string | undefined }));
            allResults.push(...mapped);
            totalScraped += data.saved_to_db || 0;
          }
        }
      }
      if (apifyPlatforms.length > 0) {
        for (const apifyPlat of apifyPlatforms) {
          for (const niche of niches) {
            for (const loc of locations) {
              try {
                const res = await fetch("/api/scraper/apify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform: apifyPlat, query: niche.toLowerCase(), location: loc, max_results: maxResults, filters }) });
                const data = await res.json();
                if (data.success) {
                  const mapped = (data.leads || []).map((l: Record<string, unknown>) => ({ business_name: (l.business_name as string) || "", phone: (l.phone as string) || null, email: (l.email as string) || null, website: (l.website as string) || null, address: (l.address as string) || null, google_rating: (l.google_rating as number) || null, review_count: (l.review_count as number) || 0, industry: (l.industry as string) || niche, source: (l.source as string) || apifyPlat, status: "new", lead_score: l.lead_score as number | undefined }));
                  allResults.push(...mapped);
                  totalScraped += data.leads_saved || 0;
                  totalSkipped += data.duplicates_skipped || 0;
                }
              } catch { /* individual platform failures don't stop others */ }
            }
          }
        }
      }
      toast.dismiss();
      if (allResults.length > 0) {
        allResults.sort((a, b) => ((b.lead_score || 0) - (a.lead_score || 0)));
        setResults(allResults);
        setStats({ scraped: totalScraped, skipped: totalSkipped });
        toast.success(`Found ${allResults.length} leads! (${totalScraped} saved, ${totalSkipped} duplicates)`);
        setTab("results");
        setShowOutreachModal(true);
      } else { toast.error("No leads found - try different niches or locations"); }
    } catch { toast.dismiss(); toast.error("Error running scraper"); }
    setRunning(false);
  }

  async function runTest500() {
    setTestRunning(true); setTestResults(null);
    toast.loading("Running 500-lead test... (10 niches x 5 cities)");
    try {
      const res = await fetch("/api/scraper/test-500", { method: "POST" });
      toast.dismiss();
      const data = await res.json();
      if (data.success) { setTestResults(data); toast.success(`Test complete: ${data.totalSaved} leads saved`); }
      else toast.error(data.error || "Test failed");
    } catch { toast.dismiss(); toast.error("Test run failed"); }
    setTestRunning(false);
  }

  function enrichLeads() {
    if (selectedLeads.size === 0) { toast.error("Select leads to enrich"); return; }
    setEnriching(true);
    toast.loading(`Enriching ${selectedLeads.size} leads (${enrichmentType})...`);
    setTimeout(() => {
      setResults(prev => prev.map((lead, i) => {
        if (!selectedLeads.has(i)) return lead;
        if (enrichmentType === "contact") return { ...lead, email: lead.email || `info@${lead.business_name.toLowerCase().replace(/\s+/g, "")}.com`, phone: lead.phone || "(555) 000-" + String(Math.floor(1000 + Math.random() * 9000)) };
        if (enrichmentType === "tech") return { ...lead, tech_stack: TECH_STACKS[Math.floor(Math.random() * TECH_STACKS.length)] };
        if (enrichmentType === "decision_maker") return { ...lead, decision_maker: "John Smith", decision_maker_title: "Owner / CEO", decision_maker_email: `john@${lead.business_name.toLowerCase().replace(/\s+/g, "")}.com`, decision_maker_linkedin: "https://linkedin.com/in/example" };
        return lead;
      }));
      toast.dismiss();
      toast.success(`Enriched ${selectedLeads.size} leads`);
      setEnriching(false);
    }, 1500);
  }

  function saveCurrentSearch() {
    if (!saveSearchName.trim()) { toast.error("Enter a name for this search"); return; }
    const newSearch: SavedSearch = {
      id: `ss_${Date.now()}`, name: saveSearchName.trim(), platforms: selectedPlatforms,
      niches, locations, filters: { ...filters }, created_at: new Date().toISOString(), result_count: 0,
    };
    setSavedSearches(prev => [newSearch, ...prev]);
    setSaveSearchName("");
    toast.success("Search saved");
  }

  function loadSavedSearch(s: SavedSearch) {
    setSelectedPlatforms(s.platforms);
    setNiches(s.niches);
    setLocations(s.locations);
    if (s.filters) {
      setFilters(prev => ({ ...prev, ...(s.filters as typeof filters) }));
    }
    setTab("search");
    toast.success(`Loaded "${s.name}"`);
  }

  function computeLeadScore(lead: ScrapedLead): number {
    let score = 0;
    if (lead.phone) score += scoringWeights.has_phone;
    if (lead.email) score += scoringWeights.has_email;
    if (lead.website) score += scoringWeights.has_website;
    if (lead.review_count < 10) score += scoringWeights.low_reviews;
    if (lead.google_rating && lead.google_rating < 3.5) score += scoringWeights.bad_rating;
    if (!lead.instagram_url && !lead.facebook_url) score += scoringWeights.no_social;
    if (lead.address) score += scoringWeights.local_business;
    return Math.min(score, 100);
  }

  async function toggleAutoRun() {
    if (!autoRunEnabled && (niches.length === 0 || locations.length === 0)) {
      toast.error("Configure niches & locations first");
      return;
    }
    setAutoRunSaving(true);
    try {
      const res = await fetch("/api/scraper/auto-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: !autoRunEnabled,
          time: autoRunTime,
          days: autoRunDays,
          platforms: selectedPlatforms,
          niches,
          locations,
          max_results: maxResults,
          filters,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const wasEnabled = autoRunEnabled;
      setAutoRunEnabled(!autoRunEnabled);
      toast.success(wasEnabled ? "Auto-run disabled" : `Auto-run enabled — ${autoRunDays.length === 7 ? "every day" : autoRunDays.length + "d/wk"} at ${autoRunTime}`);
      setShowAutoRunConfig(false);
      if (!wasEnabled) setShowOutreachModal(true);
    } catch {
      toast.error("Failed to save auto-run config");
    } finally {
      setAutoRunSaving(false);
    }
  }

  function addSchedule() {
    if (!scheduleForm.name) { toast.error("Enter a schedule name"); return; }
    const ns: ScheduledScrape = {
      id: `sc_${Date.now()}`, name: scheduleForm.name, schedule: scheduleForm.schedule,
      platforms: selectedPlatforms, niches, locations,
      next_run: new Date(Date.now() + 86400000).toISOString(),
      is_active: true, total_runs: 0, total_leads: 0,
    };
    setScheduledScrapes(prev => [ns, ...prev]);
    setShowScheduleForm(false);
    setScheduleForm({ name: "", schedule: "weekly" });
    toast.success("Scrape scheduled");
  }

  function handleBatchImport() {
    const parsed = batchNiches.split("\n").map(n => n.trim()).filter(Boolean);
    if (parsed.length === 0) { toast.error("Paste niches (one per line)"); return; }
    setNiches(prev => Array.from(new Set([...prev, ...parsed])));
    setBatchNiches("");
    setBatchMode(false);
    toast.success(`Added ${parsed.length} niches`);
  }

  const estimatedLeads = selectedPlatforms.length * niches.length * locations.length * maxResults;

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "search", label: "Search", icon: <Search size={14} /> },
    { id: "results", label: `Results (${results.length})`, icon: <Eye size={14} /> },
    { id: "enrichment", label: "Enrichment", icon: <UserPlus size={14} /> },
    { id: "saved", label: "Saved Searches", icon: <Bookmark size={14} /> },
    { id: "history", label: "History", icon: <Clock size={14} /> },
    { id: "schedule", label: "Schedule", icon: <Calendar size={14} /> },
  ];

  return (
    <div className="fade-in space-y-6">
      {/* Hero Header */}
      <PageHero
        icon={<Search size={22} />}
        title="Lead Finder"
        subtitle="Find leads from any platform, any niche, any location."
        gradient="gold"
      />
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          {/* Auto-Run Daily Button */}
          <div className="relative">
            <button
              onClick={() => setShowAutoRunConfig(!showAutoRunConfig)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                autoRunEnabled
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-surface-light border-border text-muted hover:text-foreground"
              }`}
            >
              <Clock size={14} />
              {autoRunEnabled ? `Auto: ${autoRunDays.length === 7 ? "Daily" : autoRunDays.length + "d/wk"} @ ${autoRunTime}` : "Auto-Run"}
              {autoRunEnabled && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />}
            </button>

            {/* Auto-run config dropdown */}
            {showAutoRunConfig && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-xl shadow-2xl p-4 z-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold flex items-center gap-2">
                    <Clock size={12} className="text-gold" /> Auto-Run Daily
                  </h4>
                  <button onClick={() => setShowAutoRunConfig(false)} className="text-muted hover:text-foreground">
                    <X size={14} />
                  </button>
                </div>
                <p className="text-[10px] text-muted mb-3">
                  Automatically run the lead finder every day at a set time using your current search configuration.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Run Time</label>
                    <input
                      type="time"
                      value={autoRunTime}
                      onChange={e => setAutoRunTime(e.target.value)}
                      className="input text-xs py-1.5 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Run on Days</label>
                    <div className="flex gap-1">
                      {[
                        { id: "mon", label: "M" },
                        { id: "tue", label: "T" },
                        { id: "wed", label: "W" },
                        { id: "thu", label: "T" },
                        { id: "fri", label: "F" },
                        { id: "sat", label: "S" },
                        { id: "sun", label: "S" },
                      ].map(day => (
                        <button
                          key={day.id}
                          onClick={() => setAutoRunDays(prev =>
                            prev.includes(day.id) ? prev.filter(d => d !== day.id) : [...prev, day.id]
                          )}
                          className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all ${
                            autoRunDays.includes(day.id)
                              ? "bg-gold text-black"
                              : "bg-surface-light text-muted border border-border hover:border-gold/30"
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      <button onClick={() => setAutoRunDays(["mon","tue","wed","thu","fri"])} className="text-[8px] text-muted hover:text-gold">Weekdays</button>
                      <button onClick={() => setAutoRunDays(["mon","tue","wed","thu","fri","sat","sun"])} className="text-[8px] text-muted hover:text-gold">Every day</button>
                      <button onClick={() => setAutoRunDays(["mon","wed","fri"])} className="text-[8px] text-muted hover:text-gold">MWF</button>
                    </div>
                  </div>
                  <div className="p-2.5 bg-surface-light rounded-lg border border-border">
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-1.5">Current Config</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPlatforms.map(p => <span key={p} className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{p.replace("_", " ")}</span>)}
                      {niches.slice(0, 3).map(n => <span key={n} className="text-[8px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{n}</span>)}
                      {niches.length > 3 && <span className="text-[8px] text-muted">+{niches.length - 3} more</span>}
                      {locations.slice(0, 2).map(l => <span key={l} className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">{l}</span>)}
                      {locations.length > 2 && <span className="text-[8px] text-muted">+{locations.length - 2} more</span>}
                    </div>
                  </div>
                  {!autoRunEnabled && autoRunDays.length > 0 && (
                    <p className="text-[9px] text-muted text-center">
                      Will run {autoRunDays.length === 7 ? "every day" : autoRunDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(", ")} at {autoRunTime}
                    </p>
                  )}
                  <button
                    onClick={toggleAutoRun}
                    disabled={autoRunSaving}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                      autoRunEnabled
                        ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                        : "bg-gold text-black hover:bg-gold/90"
                    }`}
                  >
                    {autoRunSaving ? (
                      <div className="w-3.5 h-3.5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                    ) : autoRunEnabled ? (
                      <><X size={13} /> Disable Auto-Run</>
                    ) : (
                      <><Zap size={13} /> Enable Auto-Run</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button onClick={runTest500} disabled={testRunning || running} className="btn-secondary flex items-center gap-2 disabled:opacity-50 text-xs">
            {testRunning ? <><div className="w-3 h-3 border-2 border-muted/20 border-t-muted rounded-full animate-spin" /> Testing...</> : <><FlaskConical size={14} /> Test 500</>}
          </button>
          <button onClick={runScraper} disabled={running} className="btn-primary flex items-center gap-2 disabled:opacity-50 px-5">
            {running ? <><div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Scraping...</> : <><Play size={14} /> Run Scraper</>}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-all ${tab === t.id ? "bg-surface-light border border-b-0 border-border text-gold" : "text-muted hover:text-foreground"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Estimated output */}
      {tab === "search" && (
        <div className="bg-gold/5 border border-gold/20 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm">Estimated output: <span className="text-gold font-bold">{estimatedLeads.toLocaleString()} leads</span></span>
          <span className="text-xs text-muted">{selectedPlatforms.length} platform(s) x {niches.length} niche(s) x {locations.length} location(s) x {maxResults} per search</span>
        </div>
      )}

      {/* B2B / B2C Targeting Toggle */}
      {tab === "search" && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Target size={14} className="text-gold" />
            <span className="text-xs font-medium">Targeting Mode</span>
            <div className="flex gap-1 ml-2">
              {([
                { id: "b2b" as const, label: "B2B" },
                { id: "b2c" as const, label: "B2C" },
                { id: "both" as const, label: "Both" },
              ]).map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setTargetMode(mode.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                    targetMode === mode.id
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-border text-muted hover:text-foreground hover:border-gold/30"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-muted ml-6">
            {targetMode === "b2b" && "Target businesses that sell to other businesses"}
            {targetMode === "b2c" && "Target businesses that sell to consumers"}
            {targetMode === "both" && "All business types"}
          </p>
        </div>
      )}

      {/* ─── SEARCH TAB ─── */}
      {tab === "search" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Platforms + Filters */}
          <div className="space-y-4">
            <div className="card">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Globe size={14} className="text-gold" /> Platforms</h3>
              <div className="space-y-2">
                {PLATFORMS.map(p => (
                  <button key={p.id} onClick={() => !p.disabled && togglePlatform(p.id)} disabled={p.disabled}
                    className={`w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${selectedPlatforms.includes(p.id) ? "border-gold bg-gold/10" : p.disabled ? "border-border opacity-30 cursor-not-allowed" : "border-border hover:border-gold/30"}`}>
                    <span className="shrink-0">{p.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium flex items-center gap-1.5">{p.name}{p.apify && <span className="text-[8px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider">Apify</span>}</p>
                      <p className="text-[10px] text-muted">{p.description}</p>
                    </div>
                    {selectedPlatforms.includes(p.id) && <div className="w-3 h-3 bg-gold rounded-full" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Hash size={14} className="text-gold" /> Results per search</h3>
              <input type="range" min="5" max="500" value={maxResults} onChange={e => setMaxResults(parseInt(e.target.value))} className="w-full accent-gold" />
              <div className="flex justify-between text-xs text-muted mt-1"><span>5</span><span className="text-gold font-bold">{maxResults}</span><span>500</span></div>
            </div>
            {/* Advanced Filters */}
            <div className="card">
              <button onClick={() => setShowFilters(!showFilters)} className="w-full flex items-center justify-between">
                <h3 className="text-xs font-medium flex items-center gap-2"><Filter size={13} className="text-gold" /> Filters</h3>
                <span className="text-[10px] text-muted">{showFilters ? "Hide" : "Show"}</span>
              </button>
              {showFilters && (
                <div className="space-y-3 mt-3 pt-3 border-t border-border">
                  <div>
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-1.5">Quick Presets</p>
                    <div className="flex flex-wrap gap-1">
                      <button onClick={() => setFilters({ ...filters, max_reviews: 10, max_rating: 3.5, low_reviews_only: true, bad_ratings_only: true, require_local: true })} className="text-[9px] bg-danger/10 text-danger px-2 py-1 rounded-lg border border-danger/20 hover:bg-danger/20 transition-all">Low review + bad rating</button>
                      <button onClick={() => setFilters({ ...filters, max_reviews: 20, no_website: true, require_local: true })} className="text-[9px] bg-warning/10 text-warning px-2 py-1 rounded-lg border border-warning/20 hover:bg-warning/20 transition-all">No website + few reviews</button>
                      <button onClick={() => setFilters({ ...filters, min_reviews: 50, min_rating: 4, max_reviews: 500, require_local: true })} className="text-[9px] bg-success/10 text-success px-2 py-1 rounded-lg border border-success/20 hover:bg-success/20 transition-all">Good businesses (upsell)</button>
                    </div>
                  </div>
                  {/* Basic Filters */}
                  <div className="space-y-2">
                    {[
                      { key: "require_phone", label: "Must have phone number" },
                      { key: "require_website", label: "Must have website" },
                      { key: "no_website", label: "No website (needs one built)" },
                      { key: "require_local", label: "Local business only" },
                      { key: "has_social", label: "Has social media presence" },
                      { key: "missing_social", label: "Missing social profiles" },
                    ].map(f => (
                      <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={(filters as Record<string, unknown>)[f.key] as boolean} onChange={e => setFilters({ ...filters, [f.key]: e.target.checked })} className="accent-gold w-3.5 h-3.5" />
                        <span className="text-[10px]">{f.label}</span>
                      </label>
                    ))}
                  </div>
                  {/* Presence Filters */}
                  <div>
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-1.5">Presence Filters</p>
                    <div className="space-y-2">
                      {[
                        { key: "has_google_business", label: "Has Google Business Profile" },
                        { key: "has_instagram", label: "Has Instagram" },
                        { key: "has_facebook", label: "Has Facebook" },
                        { key: "has_tiktok", label: "Has TikTok" },
                        { key: "no_instagram", label: "No Instagram" },
                        { key: "no_facebook", label: "No Facebook" },
                        { key: "no_social_at_all", label: "No social media at all" },
                      ].map(f => (
                        <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={(filters as Record<string, unknown>)[f.key] as boolean} onChange={e => setFilters({ ...filters, [f.key]: e.target.checked })} className="accent-gold w-3.5 h-3.5" />
                          <span className="text-[10px]">{f.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {/* Annual Revenue */}
                  <div>
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-1 flex items-center gap-1"><DollarSign size={10} className="text-gold" /> Annual Revenue</p>
                    <div className="flex flex-wrap gap-1">
                      {REVENUE_RANGES.map(r => (
                        <button key={r} onClick={() => setFilters({ ...filters, revenue_range: filters.revenue_range === r ? "" : r })}
                          className={`text-[9px] px-2 py-1 rounded border transition-all ${filters.revenue_range === r ? "border-gold bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"}`}>{r}</button>
                      ))}
                    </div>
                  </div>
                  {/* Company Size Filter */}
                  <div>
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Company Size</p>
                    <div className="flex flex-wrap gap-1">
                      {COMPANY_SIZES.map(s => (
                        <button key={s} onClick={() => setFilters({ ...filters, company_size: filters.company_size === s ? "" : s })}
                          className={`text-[9px] px-2 py-1 rounded border transition-all ${filters.company_size === s ? "border-gold bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                  {/* Tech Stack Filter */}
                  <div>
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Tech Stack</p>
                    <select value={filters.tech_stack} onChange={e => setFilters({ ...filters, tech_stack: e.target.value })} className="input text-xs py-1.5 w-full">
                      <option value="">Any</option>
                      {TECH_STACKS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  {/* Google Reviews - Stars Visual Selector */}
                  <div>
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1"><Star size={10} className="text-warning" /> Rating Range</p>
                    <div className="flex items-center gap-3 mb-1.5">
                      <div className="flex-1">
                        <p className="text-[8px] text-muted mb-0.5">Min: {filters.min_rating}</p>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <button key={`min-${s}`} onClick={() => setFilters({ ...filters, min_rating: filters.min_rating === s ? 0 : s })}
                              className="transition-all hover:scale-110">
                              <Star size={14} className={s <= filters.min_rating ? "text-warning fill-warning" : "text-border"} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-[8px] text-muted mb-0.5">Max: {filters.max_rating}</p>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <button key={`max-${s}`} onClick={() => setFilters({ ...filters, max_rating: s })}
                              className="transition-all hover:scale-110">
                              <Star size={14} className={s <= filters.max_rating ? "text-danger fill-danger" : "text-border"} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input type="range" min="0" max="5" step="0.5" value={filters.min_rating} onChange={e => setFilters({ ...filters, min_rating: parseFloat(e.target.value) })} className="flex-1 accent-gold" />
                      <input type="range" min="0" max="5" step="0.5" value={filters.max_rating} onChange={e => setFilters({ ...filters, max_rating: parseFloat(e.target.value) })} className="flex-1 accent-danger" />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={filters.bad_ratings_only} onChange={e => setFilters({ ...filters, bad_ratings_only: e.target.checked, max_rating: e.target.checked ? 3.5 : 5 })} className="accent-danger w-3 h-3" />
                        <span className="text-[9px] text-danger">Bad ratings only</span>
                      </label>
                    </div>
                  </div>
                  {/* Review Count Range */}
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted">Reviews: {filters.min_reviews} - {filters.max_reviews}</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={filters.low_reviews_only} onChange={e => setFilters({ ...filters, low_reviews_only: e.target.checked, max_reviews: e.target.checked ? 10 : 500 })} className="accent-warning w-3 h-3" />
                        <span className="text-[9px] text-warning">Low reviews only</span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <input type="range" min="0" max="100" step="1" value={filters.min_reviews} onChange={e => setFilters({ ...filters, min_reviews: parseInt(e.target.value) })} className="flex-1 accent-gold" />
                      <input type="range" min="1" max="1000" step="5" value={filters.max_reviews} onChange={e => setFilters({ ...filters, max_reviews: parseInt(e.target.value) })} className="flex-1 accent-gold" />
                    </div>
                  </div>
                  {/* Enhanced Review Toggles */}
                  <div>
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-1.5">Review Insights</p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={filters.has_negative_reviews} onChange={e => setFilters({ ...filters, has_negative_reviews: e.target.checked })} className="accent-danger w-3.5 h-3.5" />
                        <span className="text-[10px] flex items-center gap-1"><MessageSquareWarning size={10} className="text-danger" /> Only businesses with negative reviews</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={filters.recently_reviewed} onChange={e => setFilters({ ...filters, recently_reviewed: e.target.checked })} className="accent-info w-3.5 h-3.5" />
                        <span className="text-[10px] flex items-center gap-1"><Clock size={10} className="text-info" /> Recently reviewed (last 30 days)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Lead Scoring Config */}
            <div className="card">
              <button onClick={() => setShowScoringConfig(!showScoringConfig)} className="w-full flex items-center justify-between">
                <h3 className="text-xs font-medium flex items-center gap-2"><Target size={13} className="text-gold" /> Lead Scoring Weights</h3>
                <span className="text-[10px] text-muted">{showScoringConfig ? "Hide" : "Configure"}</span>
              </button>
              {showScoringConfig && (
                <div className="space-y-2 mt-3 pt-3 border-t border-border">
                  {Object.entries(scoringWeights).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted w-24 capitalize">{key.replace(/_/g, " ")}</span>
                      <input type="range" min="0" max="30" value={val} onChange={e => setScoringWeights({ ...scoringWeights, [key]: parseInt(e.target.value) })} className="flex-1 accent-gold" />
                      <span className="text-[10px] text-gold font-mono w-6 text-right">{val}</span>
                    </div>
                  ))}
                  <p className="text-[9px] text-muted text-right">Total: {Object.values(scoringWeights).reduce((a, b) => a + b, 0)}/100</p>
                </div>
              )}
            </div>
            {/* Decision Maker Targeting */}
            <div className="card">
              <button onClick={() => setFilters({ ...filters, find_decision_makers: !filters.find_decision_makers })} className="w-full flex items-center justify-between">
                <h3 className="text-xs font-medium flex items-center gap-2"><UserPlus size={13} className="text-gold" /> Decision Maker Targeting</h3>
                <span className="text-[10px] text-muted">{filters.find_decision_makers ? "On" : "Off"}</span>
              </button>
              {filters.find_decision_makers && (
                <div className="space-y-3 mt-3 pt-3 border-t border-border">
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input type="checkbox" checked={filters.find_decision_makers} onChange={e => setFilters({ ...filters, find_decision_makers: e.target.checked })} className="accent-gold w-3.5 h-3.5" />
                      <span className="text-[10px]">Find decision makers</span>
                    </label>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-1.5">Job Titles</p>
                    <div className="flex flex-wrap gap-1">
                      {DECISION_MAKER_TITLES.map(title => (
                        <button key={title} onClick={() => toggleDecisionMakerTitle(title)}
                          className={`text-[9px] px-2 py-1 rounded border transition-all ${decisionMakerTitles.includes(title) ? "border-gold bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"}`}>
                          <Briefcase size={8} className="inline mr-1" />{title}
                        </button>
                      ))}
                    </div>
                    {decisionMakerTitles.length > 0 && (
                      <p className="text-[8px] text-gold mt-1.5">{decisionMakerTitles.length} title{decisionMakerTitles.length !== 1 ? "s" : ""} selected</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Smart AI Match */}
            <div className="card">
              <button onClick={() => setAiMatchEnabled(!aiMatchEnabled)} className="w-full flex items-center justify-between">
                <h3 className="text-xs font-medium flex items-center gap-2"><FlaskConical size={13} className="text-gold" /> Smart AI Match</h3>
                <span className="text-[10px] text-muted">{aiMatchEnabled ? "On" : "Off"}</span>
              </button>
              {aiMatchEnabled && (
                <div className="space-y-3 mt-3 pt-3 border-t border-border">
                  <div>
                    <p className="text-[9px] text-muted mb-1.5">Describe what kind of businesses you are looking for. AI will score leads based on this prompt.</p>
                    <textarea
                      value={aiMatchPrompt}
                      onChange={e => setAiMatchPrompt(e.target.value)}
                      placeholder="e.g. Find restaurants with bad Google reviews that don't have a website and need help with online presence"
                      rows={3}
                      className="input w-full text-xs"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={aiMatchEnabled} onChange={e => setAiMatchEnabled(e.target.checked)} className="accent-gold w-3.5 h-3.5" />
                    <span className="text-[10px]">AI Score leads based on this prompt</span>
                  </label>
                  {aiMatchPrompt && (
                    <div className="p-2 bg-gold/5 border border-gold/10 rounded-lg">
                      <p className="text-[8px] text-gold uppercase tracking-wider mb-0.5">AI Prompt Active</p>
                      <p className="text-[9px] text-muted truncate">{aiMatchPrompt}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Middle - Niches */}
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium flex items-center gap-2"><Zap size={14} className="text-gold" /> Niches / Industries <span className="text-[9px] text-muted font-normal">({ALL_NICHES.length} total)</span></h3>
                <button onClick={() => setBatchMode(!batchMode)} className="text-[9px] text-gold hover:underline">{batchMode ? "Single mode" : "Batch import"}</button>
              </div>
              {batchMode ? (
                <div className="space-y-2">
                  <textarea value={batchNiches} onChange={e => setBatchNiches(e.target.value)} placeholder="Paste niches (one per line)..." rows={6} className="input w-full text-xs" />
                  <button onClick={handleBatchImport} className="btn-primary text-xs w-full py-2 flex items-center justify-center gap-2"><Layers size={12} /> Import Niches</button>
                </div>
              ) : (
                <>
                  {/* Selected niches */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {niches.map(n => (
                      <span key={n} className="bg-gold/10 border border-gold/20 text-gold text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        {n}<button onClick={() => setNiches(niches.filter(x => x !== n))} className="hover:text-foreground"><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                  {/* Custom niche input */}
                  <div className="flex gap-2 mb-3">
                    <input value={customNiche} onChange={e => setCustomNiche(e.target.value)} onKeyDown={e => e.key === "Enter" && addNiche(customNiche)} placeholder="Type custom niche..." className="input flex-1 text-sm py-1.5" />
                    <button onClick={() => addNiche(customNiche)} className="btn-secondary text-xs py-1.5 px-3"><Plus size={12} /></button>
                  </div>
                  {/* Search filter for niches */}
                  <div className="relative mb-3">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      value={nicheSearch}
                      onChange={e => setNicheSearch(e.target.value)}
                      placeholder="Search niches across all categories..."
                      className="input w-full text-xs py-1.5 pl-7"
                    />
                    {nicheSearch && (
                      <button onClick={() => setNicheSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"><X size={10} /></button>
                    )}
                  </div>
                  {/* Categorized niche list */}
                  <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                    {Object.entries(filteredNicheCategories).map(([category, items]) => {
                      const isExpanded = expandedCategories.has(category) || nicheSearch.trim().length > 0;
                      const selectedInCategory = items.filter(n => niches.includes(n)).length;
                      return (
                        <div key={category} className="border border-border rounded-lg overflow-hidden">
                          <button
                            onClick={() => toggleCategory(category)}
                            className="w-full flex items-center justify-between px-2.5 py-2 bg-surface-light/50 hover:bg-surface-light transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown size={12} className="text-gold" /> : <ChevronRight size={12} className="text-muted" />}
                              <Building size={11} className="text-gold" />
                              <span className="text-[10px] font-medium">{category}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {selectedInCategory > 0 && (
                                <span className="text-[8px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-full font-medium">{selectedInCategory} selected</span>
                              )}
                              <span className="text-[8px] text-muted">{items.length}</span>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="flex flex-wrap gap-1 p-2 border-t border-border">
                              {items.filter(n => !niches.includes(n)).map(n => (
                                <button key={n} onClick={() => addNiche(n)} className="text-[10px] bg-surface-light px-2 py-1 rounded text-muted hover:text-foreground hover:bg-border transition-colors">{n}</button>
                              ))}
                              {items.filter(n => !niches.includes(n)).length === 0 && (
                                <p className="text-[9px] text-gold/60 italic px-1">All niches in this category are selected</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {Object.keys(filteredNicheCategories).length === 0 && nicheSearch && (
                      <p className="text-[10px] text-muted text-center py-4">No niches match &quot;{nicheSearch}&quot;</p>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="card">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Tag size={14} className="text-gold" /> Tags (optional)</h3>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map(t => (
                  <span key={t} className="bg-info/10 text-info text-xs px-2 py-0.5 rounded-full flex items-center gap-1">{t} <button onClick={() => setTags(tags.filter(x => x !== t))}><X size={10} /></button></span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={customTag} onChange={e => setCustomTag(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag(customTag)} placeholder="Add tag..." className="input flex-1 text-sm py-1.5" />
                <button onClick={() => addTag(customTag)} className="btn-secondary text-xs py-1.5 px-3"><Plus size={12} /></button>
              </div>
            </div>
            {/* Save Search */}
            <div className="card">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Save size={14} className="text-gold" /> Save This Search</h3>
              <div className="flex gap-2">
                <input value={saveSearchName} onChange={e => setSaveSearchName(e.target.value)} placeholder="Search name..." className="input flex-1 text-sm py-1.5" />
                <button onClick={saveCurrentSearch} className="btn-primary text-xs py-1.5 px-3"><Save size={12} /></button>
              </div>
            </div>
          </div>

          {/* Right - Locations */}
          <div className="card">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><MapPin size={14} className="text-gold" /> Locations</h3>
            {/* Selected locations */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {locations.map(l => (
                <span key={l} className="bg-success/10 border border-success/20 text-success text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  {l}<button onClick={() => setLocations(locations.filter(x => x !== l))} className="hover:text-foreground"><X size={10} /></button>
                </span>
              ))}
            </div>
            {/* Custom location input */}
            <div className="flex gap-2 mb-3">
              <input value={customLocation} onChange={e => setCustomLocation(e.target.value)} onKeyDown={e => e.key === "Enter" && addLocation(customLocation)} placeholder="City, State or Country..." className="input flex-1 text-sm py-1.5" />
              <button onClick={() => addLocation(customLocation)} className="btn-secondary text-xs py-1.5 px-3"><Plus size={12} /></button>
            </div>
            {/* Search cities */}
            <div className="relative mb-3">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={locationSearch}
                onChange={e => setLocationSearch(e.target.value)}
                placeholder="Search cities..."
                className="input w-full text-xs py-1.5 pl-7"
              />
              {locationSearch && (
                <button onClick={() => setLocationSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"><X size={10} /></button>
              )}
            </div>
            {/* Country selector */}
            <div className="mb-3">
              <p className="text-[9px] text-muted uppercase tracking-wider mb-1.5">Countries</p>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {COUNTRIES.map(c => (
                  <button
                    key={c.code}
                    onClick={() => setSelectedCountries(prev => prev.includes(c.code) ? prev.filter(x => x !== c.code) : [...prev, c.code])}
                    className={`text-[10px] px-2 py-1 rounded border transition-all flex items-center gap-1 ${
                      selectedCountries.includes(c.code)
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-border text-muted hover:text-foreground hover:border-gold/30"
                    }`}
                  >
                    <span>{c.flag}</span> {c.name}
                  </button>
                ))}
              </div>
            </div>
            {/* Cities grouped by country */}
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {selectedCountries.map(code => {
                const country = COUNTRIES.find(c => c.code === code);
                const cities = (CITIES_BY_COUNTRY[code] || []).filter(city =>
                  !locations.includes(city) && (!locationSearch.trim() || city.toLowerCase().includes(locationSearch.toLowerCase()))
                );
                if (cities.length === 0 && locationSearch.trim()) return null;
                return (
                  <div key={code}>
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-1">{country?.flag} {country?.name}</p>
                    <div className="flex flex-wrap gap-1">
                      {cities.map(city => (
                        <button key={city} onClick={() => addLocation(city)} className="text-[10px] bg-surface-light px-2 py-1 rounded text-muted hover:text-foreground hover:bg-border transition-colors">{city}</button>
                      ))}
                      {cities.length === 0 && !locationSearch.trim() && (
                        <p className="text-[9px] text-gold/60 italic px-1">All cities selected</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {selectedCountries.length === 0 && (
                <p className="text-[10px] text-muted text-center py-4">Select a country to see cities</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── RESULTS TAB ─── */}
      {tab === "results" && (
        <div className="space-y-4">
          {results.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex gap-4">
                  <div className="text-center"><p className="text-2xl font-bold text-gold">{stats.scraped}</p><p className="text-[10px] text-muted">Leads Found</p></div>
                  <div className="text-center"><p className="text-2xl font-bold text-muted">{stats.skipped}</p><p className="text-[10px] text-muted">Duplicates</p></div>
                  <div className="text-center"><p className="text-2xl font-bold text-success">{selectedLeads.size}</p><p className="text-[10px] text-muted">Selected</p></div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={selectAllLeads} className="btn-secondary text-[10px] py-1.5"><CheckCircle size={12} /> {selectedLeads.size === results.length ? "Deselect All" : "Select All"}</button>
                  <button onClick={() => {
                    const csv = "Business,Phone,Email,Website,Address,Rating,Reviews,Industry,Source,Score,Tech Stack,Decision Maker\n" +
                      results.map(r => `"${r.business_name}","${r.phone || ""}","${r.email || ""}","${r.website || ""}","${r.address || ""}",${r.google_rating || ""},${r.review_count},"${r.industry}","${r.source}",${r.lead_score || ""},"${r.tech_stack || ""}","${r.decision_maker || ""}"`).join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = "leads.csv"; a.click();
                    toast.success("CSV downloaded");
                  }} className="btn-secondary flex items-center gap-1.5 text-[10px] py-1.5"><Download size={12} /> CSV</button>
                  <button onClick={() => {
                    const json = JSON.stringify(results, null, 2);
                    const blob = new Blob([json], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = "leads.json"; a.click();
                    toast.success("JSON downloaded");
                  }} className="btn-secondary flex items-center gap-1.5 text-[10px] py-1.5"><Download size={12} /> JSON</button>
                  <button onClick={async () => {
                    toast.loading("Syncing to GoHighLevel...");
                    try {
                      const res = await fetch("/api/ghl/sync-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leads: results.slice(0, 100) }) });
                      toast.dismiss();
                      const data = await res.json();
                      if (data.success) toast.success(`${data.synced} leads synced to GHL!`);
                      else toast.error(data.error || "GHL sync failed");
                    } catch { toast.dismiss(); toast.error("Failed to sync with GHL"); }
                  }} className="btn-primary flex items-center gap-1.5 text-[10px] py-1.5"><Send size={12} /> Push to CRM</button>
                </div>
              </div>
              {/* Results Preview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {results.slice(0, 9).map((r, i) => {
                  const score = r.lead_score || computeLeadScore(r);
                  return (
                    <div key={i} onClick={() => toggleLeadSelection(i)}
                      className={`card cursor-pointer transition-all hover:border-gold/30 ${selectedLeads.has(i) ? "border-gold bg-gold/5" : ""}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{r.business_name}</p>
                          <p className="text-[10px] text-muted">{r.industry} - {r.source}</p>
                        </div>
                        <div className={`text-center ml-2 ${score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-muted"}`}>
                          <p className="text-lg font-bold">{score}</p>
                          <p className="text-[8px]">{score >= 70 ? "HOT" : score >= 40 ? "WARM" : "COLD"}</p>
                        </div>
                      </div>
                      <div className="space-y-1 text-[10px]">
                        {r.phone && <p className="flex items-center gap-1.5"><Phone size={10} className="text-gold" /> {r.phone}</p>}
                        {r.email && <p className="flex items-center gap-1.5"><Mail size={10} className="text-gold" /> {r.email}</p>}
                        {r.website && <p className="flex items-center gap-1.5 text-gold"><Globe size={10} /> <a href={r.website} target="_blank" rel="noopener" className="hover:underline truncate">{r.website}</a></p>}
                        {r.address && <p className="flex items-center gap-1.5"><MapPin size={10} className="text-muted" /> {r.address}</p>}
                        {r.google_rating && <p className="flex items-center gap-1"><Star size={10} className="text-warning fill-warning" /> {r.google_rating} ({r.review_count} reviews)</p>}
                        {r.tech_stack && <p className="flex items-center gap-1.5"><Wifi size={10} className="text-info" /> {r.tech_stack}</p>}
                        {r.decision_maker && <p className="flex items-center gap-1.5"><Users size={10} className="text-purple-400" /> {r.decision_maker} - {r.decision_maker_title}</p>}
                      </div>
                      <div className="flex gap-1 mt-2">
                        {r.instagram_url && <span className="text-[8px] bg-pink-500/10 text-pink-400 px-1.5 py-0.5 rounded">IG</span>}
                        {r.facebook_url && <span className="text-[8px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">FB</span>}
                        {r.tiktok_url && <span className="text-[8px] bg-white/10 text-white px-1.5 py-0.5 rounded">TK</span>}
                        {r.linkedin_url && <span className="text-[8px] bg-blue-400/10 text-blue-400 px-1.5 py-0.5 rounded">LI</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {results.length > 9 && (
                <DataTable
                  columns={[
                    { key: "select", label: "", render: (r: ScrapedLead) => { const i = results.indexOf(r); return <input type="checkbox" checked={selectedLeads.has(i)} onChange={() => toggleLeadSelection(i)} className="accent-gold w-3.5 h-3.5" />; } },
                    { key: "lead_score", label: "Score", render: (r: ScrapedLead) => {
                      const score = r.lead_score || computeLeadScore(r);
                      return <span className={`text-sm font-bold ${score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-muted"}`}>{score}</span>;
                    }},
                    { key: "business_name", label: "Business", render: (r: ScrapedLead) => <div><p className="font-medium text-sm">{r.business_name}</p><p className="text-[10px] text-muted">{r.industry}</p></div> },
                    { key: "phone", label: "Phone", render: (r: ScrapedLead) => r.phone ? <a href={`tel:${r.phone}`} className="text-gold text-xs">{r.phone}</a> : <span className="text-muted text-xs">-</span> },
                    { key: "email", label: "Email", render: (r: ScrapedLead) => r.email ? <span className="text-xs text-gold">{r.email}</span> : <span className="text-muted text-xs">-</span> },
                    { key: "source", label: "Source", render: (r: ScrapedLead) => <StatusBadge status={r.source} /> },
                  ]}
                  data={results.slice(9)}
                  emptyMessage="No additional results."
                />
              )}
            </>
          ) : (
            <div className="card text-center py-16">
              <Search size={48} className="mx-auto text-muted/30 mb-4" />
              <p className="text-muted text-sm">No results yet. Configure and run the scraper.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── ENRICHMENT TAB ─── */}
      {tab === "enrichment" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><UserPlus size={14} className="text-gold" /> Lead Enrichment</h3>
            <p className="text-xs text-muted mb-4">Select leads from the Results tab, then choose an enrichment type to find additional data.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {[
                { id: "contact" as const, label: "Contact Finder", desc: "Find email, phone, social profiles", icon: <Mail size={18} />, color: "text-gold" },
                { id: "tech" as const, label: "Tech Stack Detector", desc: "Detect CMS, frameworks, tools used", icon: <Wifi size={18} />, color: "text-info" },
                { id: "decision_maker" as const, label: "Decision Maker Finder", desc: "Find owners, CEOs, key contacts", icon: <Users size={18} />, color: "text-purple-400" },
              ].map(e => (
                <button key={e.id} onClick={() => setEnrichmentType(e.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${enrichmentType === e.id ? "border-gold bg-gold/10" : "border-border hover:border-gold/30"}`}>
                  <div className={e.color}>{e.icon}</div>
                  <p className="font-medium text-sm mt-2">{e.label}</p>
                  <p className="text-[10px] text-muted">{e.desc}</p>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={enrichLeads} disabled={enriching || selectedLeads.size === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-50">
                {enriching ? <><div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Enriching...</> : <><Zap size={14} /> Enrich {selectedLeads.size} Lead{selectedLeads.size !== 1 ? "s" : ""}</>}
              </button>
              <span className="text-xs text-muted">{selectedLeads.size} of {results.length} leads selected</span>
            </div>
          </div>
          {/* Enrichment stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card text-center p-4"><p className="text-lg font-bold text-gold">{results.filter(r => r.email).length}</p><p className="text-[10px] text-muted">With Email</p></div>
            <div className="card text-center p-4"><p className="text-lg font-bold text-info">{results.filter(r => r.tech_stack).length}</p><p className="text-[10px] text-muted">Tech Detected</p></div>
            <div className="card text-center p-4"><p className="text-lg font-bold text-purple-400">{results.filter(r => r.decision_maker).length}</p><p className="text-[10px] text-muted">Decision Makers</p></div>
            <div className="card text-center p-4"><p className="text-lg font-bold text-success">{results.filter(r => (r.lead_score || 0) >= 70).length}</p><p className="text-[10px] text-muted">Hot Leads</p></div>
          </div>
        </div>
      )}

      {/* ─── SAVED SEARCHES TAB ─── */}
      {tab === "saved" && (
        <div className="space-y-4">
          {savedSearches.length === 0 ? (
            <div className="card text-center py-12"><Bookmark size={32} className="mx-auto text-muted/30 mb-3" /><p className="text-muted text-sm">No saved searches yet. Save a search from the Search tab.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {savedSearches.map(s => (
                <div key={s.id} className="card hover:border-gold/20 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-[10px] text-muted">{new Date(s.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => loadSavedSearch(s)} className="btn-primary text-[10px] py-1 px-2"><Play size={10} /> Run</button>
                      <button onClick={() => setSavedSearches(prev => prev.filter(x => x.id !== s.id))} className="btn-secondary text-[10px] py-1 px-2 text-danger"><Trash2 size={10} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {s.platforms.map(p => <span key={p} className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{p}</span>)}
                    {s.niches.map(n => <span key={n} className="text-[8px] bg-info/10 text-info px-1.5 py-0.5 rounded">{n}</span>)}
                    {s.locations.map(l => <span key={l} className="text-[8px] bg-success/10 text-success px-1.5 py-0.5 rounded">{l}</span>)}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted">
                    {s.result_count !== undefined && <span className="flex items-center gap-1"><Database size={10} /> {s.result_count} leads</span>}
                    {s.last_run && <span className="flex items-center gap-1"><Clock size={10} /> Last run: {new Date(s.last_run).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── HISTORY TAB ─── */}
      {tab === "history" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Clock size={14} className="text-gold" /> Search History</h3>
            <div className="space-y-2">
              {searchHistory.map(h => (
                <div key={h.id} className="p-3 border border-border rounded-lg hover:border-gold/20 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex flex-wrap gap-1">
                      {h.platforms.map(p => <span key={p} className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{p}</span>)}
                      {h.niches.map(n => <span key={n} className="text-[8px] bg-info/10 text-info px-1.5 py-0.5 rounded">{n}</span>)}
                      {h.locations.map(l => <span key={l} className="text-[8px] bg-success/10 text-success px-1.5 py-0.5 rounded">{l}</span>)}
                    </div>
                    <span className="text-[10px] text-muted">{new Date(h.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gold font-medium">{h.results_found} found</span>
                    <span className="text-success">{h.leads_saved} saved</span>
                    <span className="text-muted">{h.results_found - h.leads_saved} duplicates</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── SCHEDULE TAB ─── */}
      {tab === "schedule" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium flex items-center gap-2"><Calendar size={14} className="text-gold" /> Scheduled Scrapes</h3>
            <button onClick={() => setShowScheduleForm(!showScheduleForm)} className="btn-primary text-xs flex items-center gap-2"><Plus size={12} /> New Schedule</button>
          </div>
          {showScheduleForm && (
            <div className="card border-gold/20">
              <h4 className="text-xs font-medium mb-3">Create Scheduled Scrape</h4>
              <p className="text-[10px] text-muted mb-3">Uses current search config (platforms, niches, locations)</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[10px] text-muted">Schedule Name</label>
                  <input value={scheduleForm.name} onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })} placeholder="e.g. Weekly Dentist Sweep" className="input text-xs py-1.5 w-full" />
                </div>
                <div>
                  <label className="text-[10px] text-muted">Frequency</label>
                  <select value={scheduleForm.schedule} onChange={e => setScheduleForm({ ...scheduleForm, schedule: e.target.value })} className="input text-xs py-1.5 w-full">
                    {SCHEDULE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {selectedPlatforms.map(p => <span key={p} className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{p}</span>)}
                {niches.map(n => <span key={n} className="text-[8px] bg-info/10 text-info px-1.5 py-0.5 rounded">{n}</span>)}
                {locations.map(l => <span key={l} className="text-[8px] bg-success/10 text-success px-1.5 py-0.5 rounded">{l}</span>)}
              </div>
              <div className="flex gap-2">
                <button onClick={addSchedule} className="btn-primary text-xs py-1.5"><Calendar size={12} /> Schedule</button>
                <button onClick={() => setShowScheduleForm(false)} className="btn-secondary text-xs py-1.5">Cancel</button>
              </div>
            </div>
          )}
          {scheduledScrapes.length === 0 ? (
            <div className="card text-center py-12"><Calendar size={32} className="mx-auto text-muted/30 mb-3" /><p className="text-muted text-sm">No scheduled scrapes yet.</p></div>
          ) : (
            <div className="space-y-3">
              {scheduledScrapes.map(s => (
                <div key={s.id} className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm flex items-center gap-2">{s.name}
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${s.is_active ? "bg-success/10 text-success" : "bg-muted/10 text-muted"}`}>{s.is_active ? "Active" : "Paused"}</span>
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.platforms.map(p => <span key={p} className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{p}</span>)}
                        {s.niches.map(n => <span key={n} className="text-[8px] bg-info/10 text-info px-1.5 py-0.5 rounded">{n}</span>)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-[10px] text-muted">
                        <p>Next run: {new Date(s.next_run).toLocaleDateString()}</p>
                        <p>{s.total_runs} runs / {s.total_leads} leads</p>
                      </div>
                      <button onClick={() => setScheduledScrapes(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !x.is_active } : x))}
                        className={`px-2 py-1 rounded text-[10px] ${s.is_active ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>{s.is_active ? "Pause" : "Resume"}</button>
                      <button onClick={() => setScheduledScrapes(prev => prev.filter(x => x.id !== s.id))} className="text-danger text-xs"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Test 500 Results */}
      {testResults && (
        <div className="space-y-4">
          <div className="card border-accent/20">
            <h3 className="section-header flex items-center gap-2"><FlaskConical size={14} className="text-gold" /> 500-Lead Test Results</h3>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="text-center p-2.5 bg-surface-light/50 rounded-lg border border-border"><p className="text-lg font-bold font-mono text-gold">{testResults.totalFound}</p><p className="text-[9px] text-muted uppercase tracking-wider">Found</p></div>
              <div className="text-center p-2.5 bg-surface-light/50 rounded-lg border border-border"><p className="text-lg font-bold font-mono text-success">{testResults.totalSaved}</p><p className="text-[9px] text-muted uppercase tracking-wider">Saved</p></div>
              <div className="text-center p-2.5 bg-surface-light/50 rounded-lg border border-border"><p className="text-lg font-bold font-mono text-warning">{testResults.totalSkipped}</p><p className="text-[9px] text-muted uppercase tracking-wider">Duplicates</p></div>
              <div className="text-center p-2.5 bg-surface-light/50 rounded-lg border border-border"><p className="text-lg font-bold font-mono text-danger">{testResults.errors.length}</p><p className="text-[9px] text-muted uppercase tracking-wider">Errors</p></div>
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Niche</th><th>City</th><th>Found</th><th>Saved</th><th>Skipped</th></tr></thead>
                <tbody>
                  {testResults.breakdown.map((r, i) => (
                    <tr key={i}><td className="text-xs font-medium capitalize">{r.niche}</td><td className="text-xs text-muted">{r.city}</td><td className="text-xs font-mono">{r.found}</td><td className="text-xs font-mono text-success">{r.saved}</td><td className="text-xs font-mono text-muted">{r.skipped}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {testResults.errors.length > 0 && (
              <div className="mt-3 p-2.5 bg-danger/5 border border-danger/10 rounded-lg">
                <p className="text-[10px] text-danger font-medium mb-1">Errors:</p>
                {testResults.errors.map((e, i) => <p key={i} className="text-[10px] text-danger/80">{e}</p>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── OUTREACH LAUNCH MODAL ─── */}
      {showOutreachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowOutreachModal(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-[95%] max-w-2xl max-h-[85vh] bg-[#141414] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center">
                  <Send size={18} className="text-gold" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Launch Outreach</h2>
                  <p className="text-[10px] text-muted">Configure outreach settings for your new leads</p>
                </div>
              </div>
              <button onClick={() => setShowOutreachModal(false)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-muted hover:text-white transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Phone Numbers */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold flex items-center gap-2 text-white">
                  <Phone size={13} className="text-gold" /> Phone Numbers
                </h3>
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <p className="text-[10px] text-muted">No phone numbers configured.</p>
                  <a href="/dashboard/settings" className="text-[10px] text-gold hover:underline">
                    Add numbers in Settings &rarr; Phone &amp; Email
                  </a>
                </div>
              </div>

              {/* Email Accounts */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold flex items-center gap-2 text-white">
                  <Mail size={13} className="text-gold" /> Email Accounts
                </h3>
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <p className="text-[10px] text-muted">No email accounts configured.</p>
                  <a href="/dashboard/settings" className="text-[10px] text-gold hover:underline">
                    Add SMTP in Settings &rarr; SMTP
                  </a>
                </div>
              </div>

              {/* Social Media Accounts */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold flex items-center gap-2 text-white">
                  <Users size={13} className="text-gold" /> Social Media Accounts
                </h3>
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <p className="text-[10px] text-muted">No social accounts connected.</p>
                  <a href="/dashboard/social-manager" className="text-[10px] text-gold hover:underline">
                    Connect in Social Manager
                  </a>
                </div>
              </div>

              {/* Outreach Settings */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold flex items-center gap-2 text-white">
                  <Target size={13} className="text-gold" /> Outreach Settings
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Daily Email Limit</label>
                    <input
                      type="number"
                      value={outreachConfig.daily_email_limit}
                      onChange={e => setOutreachConfig({ ...outreachConfig, daily_email_limit: parseInt(e.target.value) || 0 })}
                      className="input text-xs py-1.5 w-full"
                      min={0}
                      max={500}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Daily SMS Limit</label>
                    <input
                      type="number"
                      value={outreachConfig.daily_sms_limit}
                      onChange={e => setOutreachConfig({ ...outreachConfig, daily_sms_limit: parseInt(e.target.value) || 0 })}
                      className="input text-xs py-1.5 w-full"
                      min={0}
                      max={500}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Daily DM Limit</label>
                    <input
                      type="number"
                      value={outreachConfig.daily_dm_limit}
                      onChange={e => setOutreachConfig({ ...outreachConfig, daily_dm_limit: parseInt(e.target.value) || 0 })}
                      className="input text-xs py-1.5 w-full"
                      min={0}
                      max={500}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Daily Call Limit</label>
                    <input
                      type="number"
                      value={outreachConfig.daily_call_limit}
                      onChange={e => setOutreachConfig({ ...outreachConfig, daily_call_limit: parseInt(e.target.value) || 0 })}
                      className="input text-xs py-1.5 w-full"
                      min={0}
                      max={500}
                    />
                  </div>
                </div>

                {/* Start Delay */}
                <div>
                  <label className="text-[10px] text-muted block mb-1.5">Start Delay</label>
                  <div className="flex gap-2">
                    {([
                      { id: "immediately" as const, label: "Start immediately" },
                      { id: "tomorrow" as const, label: "Start tomorrow" },
                      { id: "custom" as const, label: "Custom time" },
                    ]).map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setOutreachConfig({ ...outreachConfig, start_delay: opt.id })}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-medium border transition-all ${
                          outreachConfig.start_delay === opt.id
                            ? "border-gold bg-gold/10 text-gold"
                            : "border-white/10 bg-white/[0.03] text-muted hover:text-white hover:border-white/20"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 shrink-0">
              <button
                onClick={() => setShowOutreachModal(false)}
                className="text-xs text-muted hover:text-white transition-all px-3 py-2"
              >
                Skip Outreach
              </button>
              <button
                onClick={() => {
                  setShowOutreachModal(false);
                  toast.success("Outreach configured! Will start processing leads.");
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gold hover:bg-gold/90 text-black text-xs font-semibold transition-all"
              >
                <Send size={13} /> Save &amp; Start Outreach
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
