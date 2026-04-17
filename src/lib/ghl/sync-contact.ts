/**
 * GHL Contact Sync — pushes email/phone/name updates to a client's GHL sub-account.
 * Auto-creates a contact if none exists, updates otherwise. Safe to call whenever
 * a client's contact data changes in the OS.
 */

interface SyncContactInput {
  locationId: string;       // GHL sub-account ID
  contactId?: string | null; // existing GHL contact ID (null = create new)
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

interface SyncContactResult {
  success: boolean;
  contactId?: string;
  created?: boolean;
  error?: string;
}

const GHL_BASE = "https://services.leadconnectorhq.com";

export async function syncContactToGhl(input: SyncContactInput): Promise<SyncContactResult> {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) return { success: false, error: "GHL_API_KEY not configured" };
  if (!input.locationId) return { success: false, error: "locationId required" };
  if (!input.email && !input.phone) return { success: false, error: "email or phone required" };

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    "Version": "2021-07-28",
  };

  const payload: Record<string, unknown> = {
    locationId: input.locationId,
    email: input.email || undefined,
    phone: input.phone || undefined,
    firstName: input.firstName || undefined,
    lastName: input.lastName || undefined,
    companyName: input.companyName || undefined,
    tags: input.tags?.length ? input.tags : undefined,
    customFields: input.customFields && Object.keys(input.customFields).length
      ? Object.entries(input.customFields).map(([key, value]) => ({ key, field_value: value }))
      : undefined,
  };

  try {
    // UPDATE path — existing contact
    if (input.contactId) {
      const res = await fetch(`${GHL_BASE}/contacts/${input.contactId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, contactId: data.contact?.id || input.contactId, created: false };
      }
      // If the contact no longer exists, fall through to create
      if (res.status !== 404) {
        const err = await res.text();
        return { success: false, error: `GHL update ${res.status}: ${err.slice(0, 200)}` };
      }
    }

    // SEARCH by email or phone first to avoid duplicates
    const searchQuery = input.email || input.phone;
    if (searchQuery) {
      const searchRes = await fetch(`${GHL_BASE}/contacts/search/duplicate?locationId=${input.locationId}&${input.email ? "email" : "phone"}=${encodeURIComponent(searchQuery)}`, {
        headers,
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const existingId = searchData.contact?.id;
        if (existingId) {
          // update existing found contact
          const res = await fetch(`${GHL_BASE}/contacts/${existingId}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            return { success: true, contactId: existingId, created: false };
          }
        }
      }
    }

    // CREATE new contact
    const res = await fetch(`${GHL_BASE}/contacts/`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, contactId: data.contact?.id, created: true };
    }
    const err = await res.text();
    return { success: false, error: `GHL create ${res.status}: ${err.slice(0, 200)}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/* Convenience: push a client's email+phone to their GHL sub-account.
 * Reads clients row for ghl_location_id + ghl_contact_id, calls sync, writes back the contactId. */
export async function syncClientToGhl(
  clientId: string,
  service: { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }> } }; update: (v: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<unknown> } } },
): Promise<SyncContactResult> {
  const { data: client, error } = await service.from("clients").select("id,business_name,email,phone,first_name,last_name,ghl_location_id,ghl_contact_id").eq("id", clientId).single();
  if (error || !client) return { success: false, error: "Client not found" };

  const locationId = client.ghl_location_id as string | null;
  if (!locationId) return { success: false, error: "Client has no GHL sub-account yet" };

  const result = await syncContactToGhl({
    locationId,
    contactId: client.ghl_contact_id as string | null,
    email: client.email as string | null,
    phone: client.phone as string | null,
    firstName: client.first_name as string | null,
    lastName: client.last_name as string | null,
    companyName: client.business_name as string | null,
    tags: ["shortstack-os"],
  });

  // Save contactId back if new
  if (result.success && result.contactId && result.contactId !== client.ghl_contact_id) {
    await service.from("clients").update({ ghl_contact_id: result.contactId }).eq("id", clientId);
  }

  return result;
}
