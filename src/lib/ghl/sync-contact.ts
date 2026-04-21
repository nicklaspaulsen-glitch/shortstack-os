// GHL contact-sync — SUNSET Apr 21 per MEMORY migration plan.
// All callers have been migrated to the native `clients` table. Functions
// below are kept as no-op shims so any lingering caller doesn't crash.

interface SyncContactInput {
  locationId: string;
  contactId?: string | null;
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

export async function syncContactToGhl(_input: SyncContactInput): Promise<SyncContactResult> {
  return { success: false, error: "GHL contact sync is sunset — client data lives in the native `clients` table" };
}

export async function syncClientToGhl(
  _clientId: string,
  _service: unknown,
): Promise<SyncContactResult> {
  return { success: false, error: "GHL contact sync is sunset — client data lives in the native `clients` table" };
}
