import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";
import PDFDocument from "pdfkit";

export const maxDuration = 60;
export const runtime = "nodejs";

/* ── Metric labels — keep in sync with the wizard checkboxes ────── */
const METRIC_LABELS: Record<string, string> = {
  leads_scraped: "Leads Scraped",
  emails_sent: "Emails Sent",
  calls_made: "Calls Made",
  deals_moved: "Deals Moved",
  revenue_generated: "Revenue Generated",
  social_posts: "Social Posts",
  video_content: "Video Content",
  thumbnails_created: "Thumbnails Created",
  ai_tokens_used: "AI Tokens Used",
  cost_summary: "Cost Summary",
  page_views: "Page Views",
  conversion_rate: "Conversion Rate",
  top_content: "Top Content Pieces",
  customer_feedback: "Customer Feedback",
};

type MetricRow = { label: string; value: string; sub?: string };
type SectionBlock = { title: string; rows: MetricRow[]; note?: string };

interface GenerateBody {
  client_id?: string;
  date_from?: string;
  date_to?: string;
  metrics?: string[];
  email_to_client?: boolean;
}

/* ── Helpers ──────────────────────────────────────────────────── */

function fmtNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
function fmtMoney(n: number) {
  return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)}`;
}
function parseISODate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

/* ── Metric aggregation — only touches tables that exist ─────── */

async function aggregateMetrics(
  supabase: ReturnType<typeof createServiceClient>,
  clientId: string,
  fromISO: string,
  toISO: string,
  metrics: string[],
): Promise<SectionBlock[]> {
  const want = new Set(metrics);
  const out: SectionBlock[] = [];

  // Parallel fetches — guard each so a missing table on a branch won't kill the report.
  const [
    leadsRes,
    outreachSentRes,
    outreachRepliedRes,
    dealsRes,
    callsRes,
    contentAllRes,
    trinityRes,
  ] = await Promise.all([
    want.has("leads_scraped")
      ? supabase.from("leads").select("*", { count: "exact", head: true }).eq("client_id", clientId).gte("scraped_at", fromISO).lte("scraped_at", toISO)
      : Promise.resolve({ count: 0 as number | null }),
    want.has("emails_sent")
      ? supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("client_id", clientId).gte("sent_at", fromISO).lte("sent_at", toISO)
      : Promise.resolve({ count: 0 as number | null }),
    want.has("conversion_rate") || want.has("emails_sent")
      ? supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "replied").gte("sent_at", fromISO).lte("sent_at", toISO)
      : Promise.resolve({ count: 0 as number | null }),
    want.has("deals_moved") || want.has("revenue_generated")
      ? supabase.from("deals").select("value, stage, created_at, updated_at").gte("updated_at", fromISO).lte("updated_at", toISO)
      : Promise.resolve({ data: [] as Array<{ value: number | null; stage: string | null; created_at: string; updated_at: string }> | null }),
    want.has("calls_made")
      ? supabase.from("voice_calls").select("id, duration_seconds, outcome, status, started_at").eq("client_id", clientId).gte("started_at", fromISO).lte("started_at", toISO)
      : Promise.resolve({ data: [] as Array<{ id: string; duration_seconds: number | null; outcome: string | null; status: string | null; started_at: string }> | null }),
    want.has("social_posts") || want.has("video_content") || want.has("thumbnails_created") || want.has("top_content") || want.has("page_views")
      ? supabase.from("content_calendar").select("id, title, platform, status, scheduled_at, engagement_data").eq("client_id", clientId).gte("created_at", fromISO).lte("created_at", toISO)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string | null; platform: string | null; status: string | null; scheduled_at: string | null; engagement_data: Record<string, unknown> | null }> | null }),
    want.has("ai_tokens_used") || want.has("cost_summary") || want.has("customer_feedback")
      ? supabase.from("trinity_log").select("action_type, description, result, created_at").eq("client_id", clientId).gte("created_at", fromISO).lte("created_at", toISO)
      : Promise.resolve({ data: [] as Array<{ action_type: string | null; description: string | null; result: Record<string, unknown> | null; created_at: string }> | null }),
  ]);

  // Leads
  if (want.has("leads_scraped")) {
    const n = (leadsRes as { count: number | null }).count || 0;
    out.push({ title: METRIC_LABELS.leads_scraped, rows: [{ label: "New leads in window", value: fmtNumber(n) }] });
  }

  // Emails
  const emailsSent = (outreachSentRes as { count: number | null }).count || 0;
  const emailsReplied = (outreachRepliedRes as { count: number | null }).count || 0;
  if (want.has("emails_sent")) {
    out.push({
      title: METRIC_LABELS.emails_sent,
      rows: [
        { label: "Sent", value: fmtNumber(emailsSent) },
        { label: "Replied", value: fmtNumber(emailsReplied) },
        { label: "Reply rate", value: `${emailsSent > 0 ? ((emailsReplied / emailsSent) * 100).toFixed(1) : "0.0"}%` },
      ],
    });
  }

  // Calls
  if (want.has("calls_made")) {
    const calls = (callsRes as { data: Array<{ duration_seconds: number | null; outcome: string | null }> | null }).data || [];
    const totalSec = calls.reduce((s, c) => s + (c.duration_seconds || 0), 0);
    const connected = calls.filter(c => c.outcome === "connected" || c.outcome === "booked").length;
    out.push({
      title: METRIC_LABELS.calls_made,
      rows: [
        { label: "Total calls", value: fmtNumber(calls.length) },
        { label: "Connected", value: fmtNumber(connected) },
        { label: "Total talk time", value: `${(totalSec / 60).toFixed(1)} min` },
      ],
    });
  }

  // Deals & revenue
  const deals = (dealsRes as { data: Array<{ value: number | null; stage: string | null }> | null }).data || [];
  if (want.has("deals_moved")) {
    const byStage: Record<string, number> = {};
    for (const d of deals) {
      const k = d.stage || "unknown";
      byStage[k] = (byStage[k] || 0) + 1;
    }
    out.push({
      title: METRIC_LABELS.deals_moved,
      rows: [
        { label: "Total deal moves", value: fmtNumber(deals.length) },
        ...Object.entries(byStage).slice(0, 6).map(([stage, count]) => ({ label: stage, value: fmtNumber(count) })),
      ],
    });
  }
  if (want.has("revenue_generated")) {
    const wonDeals = deals.filter(d => (d.stage || "").toLowerCase() === "won" || (d.stage || "").toLowerCase() === "closed_won");
    const wonRevenue = wonDeals.reduce((s, d) => s + (d.value || 0), 0);
    const pipelineRevenue = deals.reduce((s, d) => s + (d.value || 0), 0);
    out.push({
      title: METRIC_LABELS.revenue_generated,
      rows: [
        { label: "Won revenue", value: fmtMoney(wonRevenue) },
        { label: "Pipeline touched", value: fmtMoney(pipelineRevenue) },
        { label: "Deals won", value: fmtNumber(wonDeals.length) },
      ],
    });
  }

  // Content: social/video/thumbnails/top
  const content = (contentAllRes as { data: Array<{ id: string; title: string | null; platform: string | null; status: string | null; engagement_data: Record<string, unknown> | null }> | null }).data || [];
  if (want.has("social_posts")) {
    const social = content.filter(c => (c.platform || "").match(/instagram|facebook|linkedin|twitter|x|threads/i));
    out.push({ title: METRIC_LABELS.social_posts, rows: [
      { label: "Total social posts", value: fmtNumber(social.length) },
      { label: "Published", value: fmtNumber(social.filter(c => c.status === "published").length) },
      { label: "Scheduled", value: fmtNumber(social.filter(c => c.status === "scheduled").length) },
    ]});
  }
  if (want.has("video_content")) {
    const vids = content.filter(c => (c.platform || "").match(/youtube|tiktok|shorts|reels/i));
    out.push({ title: METRIC_LABELS.video_content, rows: [
      { label: "Videos in window", value: fmtNumber(vids.length) },
      { label: "Published", value: fmtNumber(vids.filter(c => c.status === "published").length) },
    ]});
  }
  if (want.has("thumbnails_created")) {
    // Trinity log tracks thumbnail generations via action_type 'content' with subtype in result
    const trinity = (trinityRes as { data: Array<{ action_type: string | null; description: string | null; result: Record<string, unknown> | null }> | null }).data || [];
    const thumbs = trinity.filter(t => (t.description || "").toLowerCase().includes("thumbnail") || (t.result && (t.result as { type?: string })?.type?.toString().includes("thumbnail")));
    out.push({ title: METRIC_LABELS.thumbnails_created, rows: [
      { label: "Thumbnails created", value: fmtNumber(thumbs.length) },
    ]});
  }
  if (want.has("top_content")) {
    const scored = content.map(c => {
      const eng = (c.engagement_data as { impressions?: number; likes?: number; views?: number } | null) || {};
      return { title: c.title || "Untitled", platform: c.platform || "—", score: (eng.views || 0) + (eng.impressions || 0) + (eng.likes || 0) * 5 };
    }).sort((a, b) => b.score - a.score).slice(0, 5);
    out.push({ title: METRIC_LABELS.top_content, rows: scored.length
      ? scored.map(s => ({ label: `${s.title.slice(0, 48)}${s.title.length > 48 ? "…" : ""}`, value: `${fmtNumber(s.score)} pts`, sub: s.platform }))
      : [{ label: "No content activity in window", value: "—" }],
    });
  }
  if (want.has("page_views")) {
    const totalImpressions = content.reduce((s, c) => {
      const eng = (c.engagement_data as { impressions?: number; views?: number } | null) || {};
      return s + (eng.impressions || 0) + (eng.views || 0);
    }, 0);
    out.push({ title: METRIC_LABELS.page_views, rows: [
      { label: "Total impressions/views", value: fmtNumber(totalImpressions), sub: "summed across content_calendar engagement_data" },
    ]});
  }

  // AI tokens / cost / feedback — derived from trinity_log results
  const trinity = (trinityRes as { data: Array<{ action_type: string | null; description: string | null; result: Record<string, unknown> | null }> | null }).data || [];
  if (want.has("ai_tokens_used")) {
    let tokenTotal = 0;
    for (const t of trinity) {
      const r = (t.result as { tokens?: number; tokens_used?: number; usage?: { total_tokens?: number } } | null) || {};
      tokenTotal += r.tokens || r.tokens_used || r.usage?.total_tokens || 0;
    }
    out.push({ title: METRIC_LABELS.ai_tokens_used, rows: [
      { label: "AI tokens (approx.)", value: fmtNumber(tokenTotal) },
      { label: "Agent actions logged", value: fmtNumber(trinity.length) },
    ]});
  }
  if (want.has("cost_summary")) {
    let aiCost = 0;
    for (const t of trinity) {
      const r = (t.result as { cost?: number; usd?: number } | null) || {};
      aiCost += r.cost || r.usd || 0;
    }
    out.push({ title: METRIC_LABELS.cost_summary, rows: [
      { label: "AI cost (approx.)", value: fmtMoney(aiCost) },
    ]});
  }
  if (want.has("customer_feedback")) {
    const fb = trinity.filter(t => t.action_type === "feedback" || (t.description || "").toLowerCase().includes("feedback"));
    out.push({ title: METRIC_LABELS.customer_feedback, rows: fb.length
      ? fb.slice(0, 5).map(f => ({ label: (f.description || "Feedback").slice(0, 60), value: "captured" }))
      : [{ label: "No feedback captured in window", value: "—" }],
    });
  }

  // Conversion rate — derived from emails_sent -> replied
  if (want.has("conversion_rate")) {
    const rate = emailsSent > 0 ? (emailsReplied / emailsSent) * 100 : 0;
    out.push({ title: METRIC_LABELS.conversion_rate, rows: [
      { label: "Email reply rate", value: `${rate.toFixed(1)}%` },
      { label: "Emails sent", value: fmtNumber(emailsSent) },
      { label: "Replies", value: fmtNumber(emailsReplied) },
    ]});
  }

  return out;
}

/* ── White-label branding lookup ──────────────────────────────── */

async function resolveBranding(
  supabase: ReturnType<typeof createServiceClient>,
  clientId: string,
): Promise<{ brandName: string | null; primaryColor: string; logoUrl: string | null; whiteLabelActive: boolean }> {
  const { data } = await supabase
    .from("social_accounts")
    .select("metadata, account_name")
    .eq("client_id", clientId)
    .eq("platform", "white_label_config")
    .maybeSingle();
  const meta = (data?.metadata as { brand_name?: string; primary_color?: string; logo_url?: string } | null) || null;
  if (meta) {
    return {
      brandName: meta.brand_name || data?.account_name || null,
      primaryColor: meta.primary_color || "#C9A84C",
      logoUrl: meta.logo_url || null,
      whiteLabelActive: true,
    };
  }
  return { brandName: null, primaryColor: "#C9A84C", logoUrl: null, whiteLabelActive: false };
}

/* ── PDF builder — PDFKit, streaming into a Buffer ────────────── */

function buildPdf(args: {
  clientName: string;
  clientIndustry: string | null;
  dateFrom: Date;
  dateTo: Date;
  sections: SectionBlock[];
  branding: { brandName: string | null; primaryColor: string; whiteLabelActive: boolean };
}): Promise<Buffer> {
  const { clientName, clientIndustry, dateFrom, dateTo, sections, branding } = args;
  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const brand = branding.brandName || "ShortStack";
    const accent = branding.primaryColor;

    // ── Header ──
    doc.fontSize(22).fillColor(accent).text(brand, 50, 50);
    doc.fontSize(9).fillColor("#64748b").text("PERFORMANCE REPORT", 50, 78);
    doc.fontSize(9).fillColor("#64748b").text(
      `${dateFrom.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}  —  ${dateTo.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
      50, 92,
    );
    doc.moveDown(2);

    // ── Client block ──
    doc.fontSize(18).fillColor("#1f2937").text(clientName);
    if (clientIndustry) doc.fontSize(10).fillColor("#6b7280").text(clientIndustry);
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e5e7eb").stroke();
    doc.moveDown(1);

    // ── Metrics sections ──
    for (const sec of sections) {
      // Guard against running off the page
      if (doc.y > 730) doc.addPage();

      doc.fontSize(11).fillColor(accent).text(sec.title, { underline: false });
      doc.moveDown(0.3);

      for (const r of sec.rows) {
        if (doc.y > 770) doc.addPage();
        doc.fontSize(10).fillColor("#4b5563").text(`${r.label}`, 60, doc.y, { continued: true, width: 340 });
        doc.fillColor("#111827").text(`  ${r.value}`, { align: "right" });
        if (r.sub) doc.fontSize(8).fillColor("#9ca3af").text(`    ${r.sub}`);
      }
      if (sec.note) {
        doc.fontSize(9).fillColor("#6b7280").text(sec.note, 60, doc.y + 2);
      }
      doc.moveDown(0.7);
    }

    // ── Footer on every page ──
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const footerY = 800;
      doc.fontSize(8).fillColor("#9ca3af")
        .text(
          branding.whiteLabelActive
            ? `${brand} · Confidential report for ${clientName}`
            : `Generated by ShortStack OS · shortstack.work`,
          50, footerY, { align: "center", width: 495 },
        );
      doc.fontSize(8).fillColor("#9ca3af")
        .text(`Page ${i - range.start + 1} of ${range.count}`, 50, footerY + 12, { align: "center", width: 495 });
    }

    doc.end();
  });
}

/* ── POST handler ─────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: GenerateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { client_id, date_from, date_to, metrics, email_to_client } = body;
  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });
  if (!Array.isArray(metrics) || metrics.length === 0) {
    return NextResponse.json({ error: "At least one metric is required" }, { status: 400 });
  }

  // Ownership check
  const ctx = await requireOwnedClient(authSupabase, user.id, client_id);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createServiceClient();

  // Client details
  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name, contact_name, email, industry")
    .eq("id", client_id)
    .single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const now = new Date();
  const dFrom = parseISODate(date_from, new Date(now.getTime() - 30 * 86400000));
  const dTo = parseISODate(date_to, now);
  const fromISO = dFrom.toISOString();
  const toISO = dTo.toISOString();

  // Aggregate
  const sections = await aggregateMetrics(supabase, client_id, fromISO, toISO, metrics);

  // Branding
  const branding = await resolveBranding(supabase, client_id);

  // Build PDF
  const pdfBuffer = await buildPdf({
    clientName: client.business_name,
    clientIndustry: client.industry,
    dateFrom: dFrom,
    dateTo: dTo,
    sections,
    branding,
  });

  // Upload to storage: reports/<user_id>/<uuid>.pdf
  const objectKey = `${user.id}/${crypto.randomUUID()}.pdf`;
  const upload = await supabase.storage.from("reports").upload(objectKey, pdfBuffer, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upload.error) {
    return NextResponse.json({ error: "Upload failed", details: upload.error.message }, { status: 500 });
  }

  // Signed URL (7 days)
  const { data: signed, error: signedErr } = await supabase.storage
    .from("reports")
    .createSignedUrl(objectKey, 60 * 60 * 24 * 7);
  if (signedErr || !signed?.signedUrl) {
    return NextResponse.json({ error: "Failed to sign URL", details: signedErr?.message }, { status: 500 });
  }

  // Persist history row
  const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
  const { data: saved, error: saveErr } = await supabase
    .from("generated_reports")
    .insert({
      user_id: user.id,
      client_id,
      metrics,
      date_from: dateOnly(dFrom),
      date_to: dateOnly(dTo),
      pdf_url: signed.signedUrl,
      pdf_size_bytes: pdfBuffer.length,
    })
    .select("id, created_at")
    .single();
  if (saveErr) {
    // Don't fail the whole request — the PDF exists in storage and the user has a URL.
    console.error("generated_reports insert failed:", saveErr.message);
  }

  // Optional: email to client as attachment (base64)
  let emailed = false;
  let emailError: string | null = null;
  if (email_to_client && client.email) {
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
      const resendKey = process.env.SMTP_PASS || process.env.RESEND_API_KEY;
      const brandName = branding.brandName || "ShortStack";
      const fromDisplay = `${brandName} <${process.env.SMTP_FROM || "growth@mail.shortstack.work"}>`;
      const subject = `${brandName} — Performance Report (${dFrom.toLocaleDateString()} – ${dTo.toLocaleDateString()})`;
      const html = `
        <p>Hi ${client.contact_name || "there"},</p>
        <p>Your latest performance report is attached. Highlights for
        <strong>${dFrom.toLocaleDateString()} – ${dTo.toLocaleDateString()}</strong> are inside.</p>
        <p>If you have any questions, reply to this email and we'll get right back to you.</p>
        <p style="color:#6b7280;font-size:12px;margin-top:24px;">
          ${branding.whiteLabelActive ? brandName : "ShortStack OS"}
        </p>`;

      if (resendKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromDisplay,
            to: [client.email],
            subject,
            html,
            attachments: [
              {
                filename: `${client.business_name.replace(/[^a-zA-Z0-9-]/g, "_")}_report.pdf`,
                content: pdfBuffer.toString("base64"),
              },
            ],
            tags: [
              { name: "shortstack_user_id", value: user.id },
              { name: "source", value: "report_generator" },
            ],
          }),
        });
        emailed = res.ok;
        if (!res.ok) emailError = `Resend ${res.status}`;
      } else {
        // Fallback: send via the existing /api/emails/send (no attachment support) — at least notify
        const res = await fetch(`${base}/api/emails/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") || "" },
          body: JSON.stringify({
            to: client.email,
            subject,
            body: `${html}<p><a href="${signed.signedUrl}">Download the PDF</a> (link expires in 7 days).</p>`,
            client_id,
          }),
        });
        emailed = res.ok;
        if (!res.ok) emailError = `Fallback email ${res.status}`;
      }
    } catch (err) {
      emailError = err instanceof Error ? err.message : "email send failed";
    }
  }

  return NextResponse.json({
    success: true,
    id: saved?.id,
    pdf_url: signed.signedUrl,
    pdf_size_bytes: pdfBuffer.length,
    emailed,
    email_error: emailError,
  });
}

/* ── GET handler — list past reports for the caller ──────────── */

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20"), 1), 50);

  const { data, error } = await supabase
    .from("generated_reports")
    .select("id, client_id, metrics, date_from, date_to, pdf_url, pdf_size_bytes, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ success: false, error: error.message, reports: [] }, { status: 500 });
  }

  return NextResponse.json({ success: true, reports: data || [] });
}
