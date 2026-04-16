import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mock Data — will be replaced with Zernio API calls later
// ---------------------------------------------------------------------------

const MOCK_CAMPAIGNS = [
  {
    id: "cmp_001",
    name: "Spring Sale - Lookalike 1%",
    platform: "meta_ads",
    status: "active",
    objective: "conversions",
    daily_budget: 85,
    total_spend: 2340,
    impressions: 184200,
    clicks: 3120,
    ctr: 1.69,
    conversions: 87,
    cpa: 26.9,
    roas: 4.2,
    start_date: "2026-03-15",
    end_date: "2026-04-30",
    ai_optimized: true,
    audience: "Lookalike 1% - Purchasers",
    created_at: "2026-03-14T10:00:00Z",
  },
  {
    id: "cmp_002",
    name: "Brand Awareness - Video Views",
    platform: "meta_ads",
    status: "active",
    objective: "awareness",
    daily_budget: 40,
    total_spend: 1120,
    impressions: 312000,
    clicks: 4680,
    ctr: 1.5,
    conversions: 0,
    cpa: 0,
    roas: 0,
    start_date: "2026-04-01",
    end_date: null,
    ai_optimized: false,
    audience: "Interest - Fitness Enthusiasts 25-45",
    created_at: "2026-03-31T14:00:00Z",
  },
  {
    id: "cmp_003",
    name: "Search - High Intent Keywords",
    platform: "google_ads",
    status: "active",
    objective: "conversions",
    daily_budget: 120,
    total_spend: 3480,
    impressions: 42100,
    clicks: 1890,
    ctr: 4.49,
    conversions: 142,
    cpa: 24.51,
    roas: 5.8,
    start_date: "2026-02-01",
    end_date: null,
    ai_optimized: true,
    audience: "Search - Branded + Competitor Terms",
    created_at: "2026-01-30T09:00:00Z",
  },
  {
    id: "cmp_004",
    name: "Shopping - Top Products",
    platform: "google_ads",
    status: "paused",
    objective: "conversions",
    daily_budget: 60,
    total_spend: 890,
    impressions: 28300,
    clicks: 1240,
    ctr: 4.38,
    conversions: 38,
    cpa: 23.42,
    roas: 3.9,
    start_date: "2026-03-01",
    end_date: "2026-03-31",
    ai_optimized: false,
    audience: "Shopping - All Products Feed",
    created_at: "2026-02-28T11:00:00Z",
  },
  {
    id: "cmp_005",
    name: "Spark Ads - UGC Push",
    platform: "tiktok_ads",
    status: "active",
    objective: "traffic",
    daily_budget: 50,
    total_spend: 780,
    impressions: 156000,
    clicks: 5460,
    ctr: 3.5,
    conversions: 29,
    cpa: 26.9,
    roas: 2.4,
    start_date: "2026-04-05",
    end_date: "2026-05-05",
    ai_optimized: true,
    audience: "18-34 Female, Interest: Beauty",
    created_at: "2026-04-04T16:00:00Z",
  },
  {
    id: "cmp_006",
    name: "Retargeting - Cart Abandoners",
    platform: "meta_ads",
    status: "active",
    objective: "conversions",
    daily_budget: 35,
    total_spend: 560,
    impressions: 45200,
    clicks: 1808,
    ctr: 4.0,
    conversions: 64,
    cpa: 8.75,
    roas: 9.1,
    start_date: "2026-04-01",
    end_date: null,
    ai_optimized: true,
    audience: "Website Visitors - Cart Abandoners 7d",
    created_at: "2026-03-31T10:00:00Z",
  },
  {
    id: "cmp_007",
    name: "Lead Gen - Free Consultation",
    platform: "meta_ads",
    status: "ended",
    objective: "leads",
    daily_budget: 70,
    total_spend: 2100,
    impressions: 98000,
    clicks: 2940,
    ctr: 3.0,
    conversions: 112,
    cpa: 18.75,
    roas: 0,
    start_date: "2026-02-15",
    end_date: "2026-03-15",
    ai_optimized: false,
    audience: "Local - 25mi radius, homeowners 30-55",
    created_at: "2026-02-14T08:00:00Z",
  },
  {
    id: "cmp_008",
    name: "Performance Max - All Channels",
    platform: "google_ads",
    status: "active",
    objective: "conversions",
    daily_budget: 200,
    total_spend: 4200,
    impressions: 520000,
    clicks: 8320,
    ctr: 1.6,
    conversions: 198,
    cpa: 21.21,
    roas: 6.2,
    start_date: "2026-01-15",
    end_date: null,
    ai_optimized: true,
    audience: "Performance Max - Auto Segments",
    created_at: "2026-01-14T12:00:00Z",
  },
];

const MOCK_CREATIVES = [
  {
    id: "cre_001",
    campaign_id: "cmp_001",
    headline: "Spring Sale - 40% Off Everything",
    description: "Limited time offer. Transform your space with our premium collection.",
    cta: "Shop Now",
    format: "image",
    preview_url: null,
    ctr: 2.1,
    conversion_rate: 3.8,
    ab_status: "winner",
    status: "active",
  },
  {
    id: "cre_002",
    campaign_id: "cmp_001",
    headline: "Don't Miss Our Biggest Sale",
    description: "Save up to 40% on bestsellers. Free shipping over $50.",
    cta: "Shop Now",
    format: "image",
    ctr: 1.4,
    conversion_rate: 2.1,
    preview_url: null,
    ab_status: "loser",
    status: "paused",
  },
  {
    id: "cre_003",
    campaign_id: "cmp_002",
    headline: "See What Everyone's Talking About",
    description: "Join 50K+ happy customers. Watch their stories.",
    cta: "Watch More",
    format: "video",
    ctr: 1.8,
    conversion_rate: 0,
    preview_url: null,
    ab_status: "testing",
    status: "active",
  },
  {
    id: "cre_004",
    campaign_id: "cmp_005",
    headline: "This product changed my routine",
    description: "Real results from real people. See the difference.",
    cta: "Learn More",
    format: "video",
    ctr: 4.2,
    conversion_rate: 1.9,
    preview_url: null,
    ab_status: "winner",
    status: "active",
  },
  {
    id: "cre_005",
    campaign_id: "cmp_006",
    headline: "You left something behind",
    description: "Your cart misses you. Complete your order for 10% off.",
    cta: "Complete Purchase",
    format: "image",
    ctr: 5.1,
    conversion_rate: 7.2,
    preview_url: null,
    ab_status: "winner",
    status: "active",
  },
  {
    id: "cre_006",
    campaign_id: "cmp_003",
    headline: "Top-Rated by 10,000+ Reviews",
    description: "See why customers rate us 4.9/5. Try risk-free today.",
    cta: "Get Started",
    format: "text",
    ctr: 5.6,
    conversion_rate: 4.1,
    preview_url: null,
    ab_status: null,
    status: "active",
  },
];

const MOCK_AUDIENCES = [
  { id: "aud_001", name: "Lookalike 1% - Purchasers", type: "lookalike", size: 2100000, platform: "meta_ads", campaigns_using: 2 },
  { id: "aud_002", name: "Website Visitors - 30 days", type: "retargeting", size: 45000, platform: "meta_ads", campaigns_using: 1 },
  { id: "aud_003", name: "Cart Abandoners - 7 days", type: "retargeting", size: 3200, platform: "meta_ads", campaigns_using: 1 },
  { id: "aud_004", name: "Interest - Fitness 25-45", type: "saved", size: 8500000, platform: "meta_ads", campaigns_using: 1 },
  { id: "aud_005", name: "In-Market - Home Improvement", type: "saved", size: 12000000, platform: "google_ads", campaigns_using: 2 },
  { id: "aud_006", name: "Beauty Enthusiasts 18-34", type: "saved", size: 6200000, platform: "tiktok_ads", campaigns_using: 1 },
  { id: "aud_007", name: "Email Subscribers", type: "custom", size: 18500, platform: "meta_ads", campaigns_using: 0 },
];

const MOCK_AI_LOG = [
  { id: "log_001", timestamp: "2026-04-16T09:15:00Z", action: "Paused underperforming ad set 'Broad Interest - Men 18-65' in Spring Sale campaign. CPA exceeded $50 threshold.", platform: "meta_ads", type: "pause" },
  { id: "log_002", timestamp: "2026-04-16T08:30:00Z", action: "Increased daily budget for 'Retargeting - Cart Abandoners' from $30 to $35. ROAS consistently above 8x for 5 days.", platform: "meta_ads", type: "budget" },
  { id: "log_003", timestamp: "2026-04-15T22:00:00Z", action: "Shifted $20/day budget from Google Shopping to Performance Max. PMax showing 58% better CPA.", platform: "google_ads", type: "budget" },
  { id: "log_004", timestamp: "2026-04-15T16:45:00Z", action: "Created new A/B test variant for Spark Ads UGC creative. Testing hook: 'Wait till you see this transformation'.", platform: "tiktok_ads", type: "creative" },
  { id: "log_005", timestamp: "2026-04-15T11:20:00Z", action: "Expanded lookalike audience from 1% to 2% for Spring Sale. 1% audience showing signs of saturation (frequency > 3).", platform: "meta_ads", type: "audience" },
  { id: "log_006", timestamp: "2026-04-14T14:00:00Z", action: "Reduced bid cap on Search campaign by 12%. Conversion rate stable, lowering CPA from $27 to $24.51.", platform: "google_ads", type: "bid" },
];

// ---------------------------------------------------------------------------
// GET — Return all ads manager data
// ---------------------------------------------------------------------------
export async function GET() {
  const totalSpend = MOCK_CAMPAIGNS.reduce((s, c) => s + c.total_spend, 0);
  const totalImpressions = MOCK_CAMPAIGNS.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = MOCK_CAMPAIGNS.reduce((s, c) => s + c.clicks, 0);
  const totalConversions = MOCK_CAMPAIGNS.reduce((s, c) => s + c.conversions, 0);
  const avgRoas = MOCK_CAMPAIGNS.filter(c => c.roas > 0).reduce((s, c) => s + c.roas, 0) / MOCK_CAMPAIGNS.filter(c => c.roas > 0).length;

  return NextResponse.json({
    overview: {
      total_spend: totalSpend,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_conversions: totalConversions,
      avg_roas: Math.round(avgRoas * 10) / 10,
      ctr: Math.round((totalClicks / totalImpressions) * 10000) / 100,
    },
    campaigns: MOCK_CAMPAIGNS,
    creatives: MOCK_CREATIVES,
    audiences: MOCK_AUDIENCES,
    ai_log: MOCK_AI_LOG,
    platforms_connected: {
      meta_ads: true,
      google_ads: true,
      tiktok_ads: false,
    },
  });
}

// ---------------------------------------------------------------------------
// POST — Save campaign configuration
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "create_campaign") {
      const newCampaign = {
        id: `cmp_${Date.now()}`,
        ...body.campaign,
        total_spend: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        conversions: 0,
        cpa: 0,
        roas: 0,
        created_at: new Date().toISOString(),
      };
      return NextResponse.json({ success: true, campaign: newCampaign });
    }

    if (action === "update_campaign") {
      return NextResponse.json({ success: true, campaign: body.campaign });
    }

    if (action === "bulk_action") {
      return NextResponse.json({
        success: true,
        affected: body.campaign_ids?.length || 0,
        action: body.bulk_action,
      });
    }

    if (action === "generate_copy") {
      // Mock AI-generated ad copy
      const variations = [
        {
          headline: "Transform Your Results Today",
          description: "Join thousands who already made the switch. Limited spots available.",
          cta: "Get Started Free",
        },
        {
          headline: "Why Wait? Start Seeing Results",
          description: "Proven strategy. Real outcomes. Try risk-free for 30 days.",
          cta: "Claim Your Spot",
        },
        {
          headline: "The Secret Top Brands Use",
          description: "Unlock the same strategies used by industry leaders. Your turn.",
          cta: "Learn More",
        },
      ];
      return NextResponse.json({ success: true, variations });
    }

    if (action === "save_rule") {
      return NextResponse.json({ success: true, rule: { id: `rule_${Date.now()}`, ...body.rule } });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}
