/**
 * AI line-item drafter.
 *
 * Given a natural-language scope + any historical invoice context, calls
 * Claude and returns a JSON block of line_items ready to save. The system
 * prompt is cached (it's large and stable) so the drafter is cheap to call
 * repeatedly within a session.
 */
import { anthropic, MODEL_SONNET, getResponseText, safeJsonParse } from "@/lib/ai/claude-helpers";

export interface DraftedLineItem {
  description: string;
  qty: number;
  unit_price_cents: number;
}

export interface DrafterResult {
  line_items: DraftedLineItem[];
  estimated_total_cents: number;
  reasoning?: string;
}

export interface DrafterContext {
  clientName?: string;
  clientPackageTier?: string;
  clientIndustry?: string;
  priorInvoices?: Array<{
    invoice_number?: string | null;
    total_cents?: number | null;
    line_items?: Array<{ description?: string; qty?: number; unit_price_cents?: number }> | null;
    issue_date?: string | null;
  }>;
}

const SYSTEM_PROMPT = `You are an elite back-office assistant for a marketing/creative agency. Your job: turn a short natural-language scope (e.g. "Video editing for Acme - 3 reels + 1 long-form") into a realistic invoice line-item list that the agency owner can edit and send to their client.

### Output contract (STRICT JSON, no prose, no code fences)

{
  "line_items": [
    {
      "description": string,     // e.g. "Short-form reel edit (60-90s, captions, music)"
      "qty": number,             // integer, > 0
      "unit_price_cents": number // integer cents, e.g. 25000 for $250
    }
  ],
  "estimated_total_cents": number,  // sum of qty * unit_price_cents across line_items
  "reasoning": string               // one or two sentences explaining how you arrived at the pricing
}

### Pricing heuristics

Use these as defaults unless the scope specifies otherwise OR the prior-invoice context shows a different rate for this client. Always round to the nearest $5 (500 cents).

- Short-form reel / TikTok edit (under 90s): $200 - $300 per deliverable
- Long-form YouTube edit (5-15 min): $600 - $1,200 per deliverable
- Podcast edit (45-60 min): $350 - $500 per deliverable
- Thumbnail design (single, with 2 revisions): $75 - $150
- Social media management (per month, 4-5 platforms): $1,500 - $3,000
- Paid ads management (per month, $5k-$20k spend): $1,500 - $2,500
- Copywriting (per article or ad campaign): $150 - $400
- Strategy/consulting (hourly): $150 - $250/hr
- Website design (basic landing page): $1,500 - $3,500
- Brand identity (logo + basic guide): $1,500 - $5,000

If prior invoices show this client has been charged a specific rate before, MATCH that rate. Consistency beats heuristics.

### Line item quality rules

- Descriptions must be specific and client-friendly. "Video edit" is bad. "Short-form reel edit (60-90s, captions, music, 1 revision)" is good.
- Break scope into discrete deliverables the client can scan: each type of output gets its own line.
- Quantities must be integers. If the scope says "a bunch of thumbnails" and you can't infer a count, use qty=1 and describe it as a pack.
- Never invent scope items the user didn't request. Stick to what the prompt implies.
- Currency is cents (USD). unit_price_cents * qty must equal the line total the client would pay for that item.
- estimated_total_cents must equal the sum of qty * unit_price_cents across all line_items.

### Hard rules

- Return ONLY the JSON object. No markdown. No commentary. No fences.
- Every field is required, no nulls.
- line_items must have at least one entry.
- Minimum unit_price_cents is 500 (five dollars).`;

export async function draftLineItems(
  scope: string,
  ctx: DrafterContext = {},
): Promise<DrafterResult> {
  const clientBlock = [
    ctx.clientName ? `Client name: ${ctx.clientName}` : null,
    ctx.clientPackageTier ? `Current package: ${ctx.clientPackageTier}` : null,
    ctx.clientIndustry ? `Industry: ${ctx.clientIndustry}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const priorBlock =
    ctx.priorInvoices && ctx.priorInvoices.length
      ? `### Prior invoices for this client (newest first)
${ctx.priorInvoices
  .slice(0, 5)
  .map((inv) => {
    const items = Array.isArray(inv.line_items) ? inv.line_items : [];
    const lines = items
      .map(
        (li) =>
          `    - ${li.qty || 1}x ${li.description || "(no description)"} @ ${(li.unit_price_cents ?? 0) / 100}`,
      )
      .join("\n");
    return `- ${inv.invoice_number || "draft"} (${inv.issue_date || "undated"}, total $${(inv.total_cents ?? 0) / 100})\n${lines}`;
  })
  .join("\n\n")}`
      : "";

  const userMessage = `### Scope (from the agency owner)
${scope}

${clientBlock ? `### Client context\n${clientBlock}\n\n` : ""}${priorBlock}

Return the JSON object defined in the system prompt.`;

  const response = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 2000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const text = getResponseText(response);
  const parsed = safeJsonParse<DrafterResult>(text);
  if (!parsed) throw new Error("Claude returned non-JSON output");

  // Re-derive estimated_total_cents server-side to protect against drift.
  const items = (Array.isArray(parsed.line_items) ? parsed.line_items : [])
    .map((li) => ({
      description: String(li.description || "").trim(),
      qty: Math.max(1, Math.round(Number(li.qty || 1))),
      unit_price_cents: Math.max(500, Math.round(Number(li.unit_price_cents || 0))),
    }))
    .filter((i) => i.description);

  const estimated_total_cents = items.reduce((s, i) => s + i.qty * i.unit_price_cents, 0);

  return {
    line_items: items,
    estimated_total_cents,
    reasoning: parsed.reasoning || "",
  };
}
