// GoHighLevel service — SUNSET Apr 21 per MEMORY migration plan.
// All functions are now no-op shims that return "not supported" results so
// callers that haven't been fully migrated don't crash.
//
// TODO: migrate remaining callers to native equivalents:
//   - createGHLContact / importLeadToGHL → direct insert into `leads` / `clients`
//   - searchGHLContacts → Supabase query on `leads` / `clients`
//   - addContactToPipeline → no native equivalent yet

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

export async function createGHLContact(_contact: GHLContact): Promise<string | null> {
  return null;
}

export async function addContactToPipeline(
  _contactId: string,
  _pipelineId: string,
  _stageId: string,
): Promise<boolean> {
  return false;
}

// Round-robin assignment to cold callers — still useful, kept for native callers.
let currentCallerIndex = 0;

export function getNextColdCaller(callers: string[]): string {
  if (callers.length === 0) return "unassigned";
  const caller = callers[currentCallerIndex % callers.length];
  currentCallerIndex++;
  return caller;
}

export async function importLeadToGHL(_lead: {
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
  return { contactId: null, success: false };
}

export async function searchGHLContacts(_query: string): Promise<unknown[]> {
  return [];
}
