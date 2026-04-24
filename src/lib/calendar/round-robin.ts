/**
 * Round-robin + fair + first-available booking assignment engine.
 *
 * Given a booking_team_id and a candidate slot [slotStart, slotEnd), picks the
 * team member who should receive the booking according to the team's
 * distribution_mode, respecting each member's calendar_rules availability and
 * calendar_slots_blocked entries.
 *
 * Distribution modes:
 *   - round_robin     : rotate based on booking_teams.last_assigned_user_id
 *   - fair            : pick the member with the fewest assignments_count
 *   - first_available : pick the first member (ordered by priority desc) who is free
 *
 * If the chosen member is unavailable for the slot, we fall back to
 * first_available among the remaining team members. Returns null if no
 * team member can take the slot.
 *
 * Persists `last_assigned_user_id` on the team, and bumps
 * `assignments_count` / `last_assigned_at` on the chosen member.
 */
import { SupabaseClient } from "@supabase/supabase-js";

export interface AssignBookingResult {
  userId: string;
  memberId: string;
  distributionMode: string;
  reason: "primary" | "fallback_unavailable" | "fallback_first_available";
}

export interface AssignBookingOptions {
  service: SupabaseClient;
  teamId: string;
  slotStart: Date;
  slotEnd: Date;
}

interface TeamMemberRow {
  id: string;
  user_id: string;
  priority: number;
  assignments_count: number;
  last_assigned_at: string | null;
  active: boolean;
}

interface BookingTeamRow {
  id: string;
  owner_user_id: string;
  distribution_mode: "round_robin" | "fair" | "first_available";
  last_assigned_user_id: string | null;
  active: boolean;
}

/**
 * Assign a booking slot to a team member.
 * Returns { userId, memberId, ... } on success, null if no member is available.
 */
export async function assignBookingToMember(
  options: AssignBookingOptions,
): Promise<AssignBookingResult | null> {
  const { service, teamId, slotStart, slotEnd } = options;

  const { data: team } = await service
    .from("booking_teams")
    .select("id, owner_user_id, distribution_mode, last_assigned_user_id, active")
    .eq("id", teamId)
    .maybeSingle();
  if (!team || !(team as BookingTeamRow).active) return null;
  const teamRow = team as BookingTeamRow;

  const { data: membersRaw } = await service
    .from("booking_team_members")
    .select("id, user_id, priority, assignments_count, last_assigned_at, active")
    .eq("team_id", teamId)
    .eq("active", true)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });
  const members = (membersRaw || []) as TeamMemberRow[];
  if (members.length === 0) return null;

  // Narrow to members available in this slot
  const availability = await Promise.all(
    members.map(async (m) => ({
      member: m,
      available: await isMemberAvailable(service, m.user_id, slotStart, slotEnd),
    })),
  );
  const availableMembers = availability.filter((a) => a.available).map((a) => a.member);
  if (availableMembers.length === 0) return null;

  const mode = teamRow.distribution_mode;
  let picked: TeamMemberRow | null = null;
  let reason: AssignBookingResult["reason"] = "primary";

  if (mode === "first_available") {
    picked = availableMembers[0];
  } else if (mode === "fair") {
    picked = [...availableMembers].sort(
      (a, b) => a.assignments_count - b.assignments_count ||
                b.priority - a.priority,
    )[0];
  } else {
    // round_robin: next after last_assigned_user_id
    picked = pickRoundRobin(members, availableMembers, teamRow.last_assigned_user_id);
    if (!picked) {
      picked = availableMembers[0];
      reason = "fallback_first_available";
    } else if (!availableMembers.find((m) => m.id === picked!.id)) {
      // primary rotation pick is unavailable — fall back
      picked = availableMembers[0];
      reason = "fallback_unavailable";
    }
  }

  if (!picked) return null;

  // Persist rotation state
  await service
    .from("booking_teams")
    .update({ last_assigned_user_id: picked.user_id })
    .eq("id", teamId);

  await service
    .from("booking_team_members")
    .update({
      assignments_count: picked.assignments_count + 1,
      last_assigned_at: new Date().toISOString(),
    })
    .eq("id", picked.id);

  return {
    userId: picked.user_id,
    memberId: picked.id,
    distributionMode: mode,
    reason,
  };
}

/**
 * Pick the next member in round-robin order starting AFTER the
 * last_assigned_user_id. Loops around. Only returns members that are in
 * `available`; if the rotation lands on an unavailable member, returns
 * the first *available* member after that position.
 */
function pickRoundRobin(
  allMembers: TeamMemberRow[],
  available: TeamMemberRow[],
  lastUserId: string | null,
): TeamMemberRow | null {
  if (available.length === 0) return null;
  if (!lastUserId) return available[0];

  // Locate position in the full ordered list
  const startIdx = allMembers.findIndex((m) => m.user_id === lastUserId);
  if (startIdx === -1) return available[0];

  const orderedAfter: TeamMemberRow[] = [
    ...allMembers.slice(startIdx + 1),
    ...allMembers.slice(0, startIdx + 1),
  ];
  for (const m of orderedAfter) {
    if (available.find((a) => a.id === m.id)) return m;
  }
  return available[0];
}

/**
 * Check whether a user is available for [slotStart, slotEnd).
 * Requires: (1) an active calendar_rules row covering that weekday + time,
 *           (2) no overlapping calendar_slots_blocked entry,
 *           (3) no overlapping calendar_events row.
 */
export async function isMemberAvailable(
  service: SupabaseClient,
  userId: string,
  slotStart: Date,
  slotEnd: Date,
): Promise<boolean> {
  // Block check
  const { data: blocks } = await service
    .from("calendar_slots_blocked")
    .select("starts_at, ends_at")
    .eq("user_id", userId)
    .lt("starts_at", slotEnd.toISOString())
    .gt("ends_at", slotStart.toISOString());
  if (blocks && blocks.length > 0) return false;

  // Existing event overlap (native calendar_events uses date + time + duration)
  const dateStr = `${slotStart.getFullYear()}-${String(slotStart.getMonth() + 1).padStart(2, "0")}-${String(slotStart.getDate()).padStart(2, "0")}`;
  const { data: existing } = await service
    .from("calendar_events")
    .select("date, time, duration")
    .eq("user_id", userId)
    .eq("date", dateStr);
  if (existing) {
    for (const ev of existing) {
      const [h, m] = String(ev.time || "09:00").split(":").map(Number);
      const durMin = Number(ev.duration || 30);
      const evStart = new Date(slotStart);
      evStart.setHours(h, m, 0, 0);
      const evEnd = new Date(evStart.getTime() + durMin * 60000);
      if (evStart < slotEnd && evEnd > slotStart) return false;
    }
  }

  // Rule check
  const { data: rules } = await service
    .from("calendar_rules")
    .select("day_of_week, start_time, end_time, active")
    .eq("user_id", userId)
    .eq("active", true);
  if (!rules || rules.length === 0) {
    // Fall back to calendar_availability for back-compat with single-user flow
    const { data: legacy } = await service
      .from("calendar_availability")
      .select("weekday, start_time, end_time, is_active")
      .eq("user_id", userId)
      .eq("is_active", true);
    if (!legacy || legacy.length === 0) {
      // No rules at all → treat as unavailable for team bookings (safer)
      return false;
    }
    return slotInRules(
      legacy.map((r) => ({
        day_of_week: (r as { weekday: number }).weekday,
        start_time: (r as { start_time: string }).start_time,
        end_time: (r as { end_time: string }).end_time,
      })),
      slotStart,
      slotEnd,
    );
  }

  return slotInRules(
    rules as Array<{ day_of_week: number; start_time: string; end_time: string }>,
    slotStart,
    slotEnd,
  );
}

function slotInRules(
  rules: Array<{ day_of_week: number; start_time: string; end_time: string }>,
  slotStart: Date,
  slotEnd: Date,
): boolean {
  const weekday = slotStart.getDay();
  const todayRules = rules.filter((r) => r.day_of_week === weekday);
  for (const r of todayRules) {
    const [sh, sm] = r.start_time.split(":").map(Number);
    const [eh, em] = r.end_time.split(":").map(Number);
    const start = new Date(slotStart);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(slotStart);
    end.setHours(eh, em, 0, 0);
    if (slotStart >= start && slotEnd <= end) return true;
  }
  return false;
}

/**
 * Preview the next N assignments for a team without actually booking anything.
 * Used in the team builder UI.
 */
export async function previewAssignments(
  service: SupabaseClient,
  teamId: string,
  count: number,
): Promise<Array<{ order: number; userId: string | null; name?: string }>> {
  const { data: team } = await service
    .from("booking_teams")
    .select("id, distribution_mode, last_assigned_user_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return [];

  const { data: membersRaw } = await service
    .from("booking_team_members")
    .select("id, user_id, priority, assignments_count, last_assigned_at, active, created_at")
    .eq("team_id", teamId)
    .eq("active", true)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });
  const members = (membersRaw || []) as unknown as TeamMemberRow[];
  if (members.length === 0) return [];

  // Fetch display names
  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name, email")
    .in("id", members.map((m) => m.user_id));
  const nameMap = new Map<string, string>();
  for (const p of profiles || []) {
    const row = p as { id: string; full_name: string | null; email: string | null };
    nameMap.set(row.id, row.full_name || row.email || "—");
  }

  const teamRow = team as { distribution_mode: string; last_assigned_user_id: string | null };
  const mode = teamRow.distribution_mode;
  const result: Array<{ order: number; userId: string | null; name?: string }> = [];
  let lastUserId = teamRow.last_assigned_user_id;
  // Clone counts so we don't persist anything
  const counts = new Map<string, number>();
  for (const m of members) counts.set(m.id, m.assignments_count);

  for (let i = 0; i < count; i++) {
    let picked: TeamMemberRow | null = null;
    if (mode === "fair") {
      picked = [...members].sort(
        (a, b) =>
          (counts.get(a.id) || 0) - (counts.get(b.id) || 0) || b.priority - a.priority,
      )[0];
    } else if (mode === "first_available") {
      picked = members[0];
    } else {
      picked = pickRoundRobin(members, members, lastUserId);
    }
    if (!picked) break;
    counts.set(picked.id, (counts.get(picked.id) || 0) + 1);
    lastUserId = picked.user_id;
    result.push({ order: i + 1, userId: picked.user_id, name: nameMap.get(picked.user_id) });
  }
  return result;
}
