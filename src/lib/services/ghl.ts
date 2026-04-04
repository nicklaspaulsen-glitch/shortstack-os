// GoHighLevel API Service — Lead import and pipeline management

interface GHLContact {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  country?: string;
  website?: string;
  tags?: string[];
  source?: string;
  customField?: Record<string, string>;
}

interface GHLContactResponse {
  contact: {
    id: string;
    [key: string]: unknown;
  };
}

const GHL_BASE_URL = "https://services.leadconnectorhq.com";

async function ghlFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey || !locationId) throw new Error("GHL API key or location ID not configured");

  return fetch(`${GHL_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Version: "2021-07-28",
      ...options.headers,
    },
  });
}

export async function createGHLContact(contact: GHLContact): Promise<string | null> {
  try {
    const locationId = process.env.GHL_LOCATION_ID;
    const res = await ghlFetch("/contacts/", {
      method: "POST",
      body: JSON.stringify({
        ...contact,
        locationId,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("GHL create contact error:", err);
      return null;
    }

    const data: GHLContactResponse = await res.json();
    return data.contact?.id || null;
  } catch (err) {
    console.error("GHL create contact error:", err);
    return null;
  }
}

export async function addContactToPipeline(
  contactId: string,
  pipelineId: string,
  stageId: string
): Promise<boolean> {
  try {
    const res = await ghlFetch("/opportunities/", {
      method: "POST",
      body: JSON.stringify({
        pipelineId,
        locationId: process.env.GHL_LOCATION_ID,
        stageId,
        contactId,
        status: "open",
        name: "New Lead",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Round-robin assignment to cold callers
let currentCallerIndex = 0;

export function getNextColdCaller(callers: string[]): string {
  if (callers.length === 0) return "unassigned";
  const caller = callers[currentCallerIndex % callers.length];
  currentCallerIndex++;
  return caller;
}

export async function importLeadToGHL(lead: {
  business_name: string;
  owner_name?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  industry?: string | null;
  google_rating?: number | null;
  review_count?: number;
}): Promise<{ contactId: string | null; success: boolean }> {
  const nameParts = lead.owner_name?.split(" ") || [lead.business_name];

  const contactId = await createGHLContact({
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(" ") || undefined,
    name: lead.business_name,
    email: lead.email || undefined,
    phone: lead.phone || undefined,
    address1: lead.address || undefined,
    city: lead.city || undefined,
    state: lead.state || undefined,
    country: lead.country || "US",
    website: lead.website || undefined,
    tags: [lead.industry || "lead", "auto-scraped"],
    source: "ShortStack Lead Engine",
    customField: {
      google_rating: String(lead.google_rating || ""),
      review_count: String(lead.review_count || 0),
    },
  });

  return { contactId, success: !!contactId };
}

export async function searchGHLContacts(query: string): Promise<unknown[]> {
  try {
    const locationId = process.env.GHL_LOCATION_ID;
    const res = await ghlFetch(`/contacts/search/duplicate?locationId=${locationId}&query=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.contacts || [];
  } catch {
    return [];
  }
}
