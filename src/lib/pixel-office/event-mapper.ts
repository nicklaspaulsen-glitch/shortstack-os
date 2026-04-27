/**
 * Pixel Agent Office — DB-event to pixel-action mapper.
 *
 * Every Supabase realtime payload that arrives on the office channel is
 * fed through `eventToAction()`. Output is either:
 *   • An `AgentAction` describing what character to animate, what
 *     animation to play, and an optional summary line for the side
 *     panel feed; or
 *   • `null` if the row is irrelevant (different agency, status didn't
 *     transition into "active", etc.) — the scene controller filters
 *     these out without re-rendering.
 *
 * Producers that emit `agent_activity_events` rows will hit the catch-all
 * branch by default; the table-specific branches below decode the
 * payload's columns directly so we don't need a denormalised event for
 * every domain table.
 */

import { AGENT_BY_KEY, type AgentKey } from "./agents";

/**
 * Animation a pixel character can play. Composes with movement state in
 * `agent-character.ts`: `walking → working → returning_home → idle`.
 */
export type AgentAnimationKind =
  | "walk_to_work"
  | "play_work"
  | "celebrate"
  | "alert";

export interface AgentAction {
  agentKey: AgentKey;
  kind: AgentAnimationKind;
  /** Single-line summary for the side panel + global event feed. */
  summary: string;
  /** Source table for traceability. */
  refTable: string;
  /** Optional ref id for click-through. */
  refId?: string;
  /** Tile to walk to before playing the work animation. */
  workTile?: { x: number; y: number };
  /** Created-at timestamp (ISO). Defaults to now if upstream didn't set. */
  ts: string;
}

interface RealtimePayload<T = Record<string, unknown>> {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new?: T;
  old?: T;
  errors: string[] | null;
}

/**
 * Coerce arbitrary realtime payloads to a deterministic agent action.
 *
 * Returns null when the payload doesn't move the office (irrelevant
 * status changes, deletes, missing required columns).
 */
export function eventToAction(payload: RealtimePayload): AgentAction | null {
  const ts = payload.commit_timestamp || new Date().toISOString();
  const row = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;

  switch (payload.table) {
    case "voice_calls": {
      // Echo answers inbound calls. We trigger on INSERT (new call) and
      // any UPDATE that flips status into "answered" or "completed".
      const status = stringField(row, "status");
      const direction = stringField(row, "direction");
      const id = stringField(row, "id");

      if (payload.eventType === "INSERT") {
        return {
          agentKey: "echo",
          kind: "walk_to_work",
          summary:
            direction === "outbound"
              ? "Placing outbound call"
              : "Inbound call ringing",
          refTable: "voice_calls",
          refId: id,
          workTile: AGENT_BY_KEY.echo?.workDesk,
          ts,
        };
      }
      if (payload.eventType === "UPDATE" && status === "completed") {
        return {
          agentKey: "echo",
          kind: "celebrate",
          summary: "Call wrapped — Echo is filing the transcript",
          refTable: "voice_calls",
          refId: id,
          ts,
        };
      }
      return null;
    }

    case "coach_analyses": {
      // Lyra reviewed a call. INSERT only — analyses are immutable.
      if (payload.eventType !== "INSERT") return null;
      const score = numberField(row, "score");
      return {
        agentKey: "lyra",
        kind: "play_work",
        summary:
          typeof score === "number"
            ? `Coach review complete — score ${Math.round(score)}/100`
            : "Coach review complete",
        refTable: "coach_analyses",
        refId: stringField(row, "id"),
        workTile: AGENT_BY_KEY.lyra?.workDesk,
        ts,
      };
    }

    case "lead_scores":
    case "lead_score_history": {
      const score = numberField(row, "score");
      const isCelebration = typeof score === "number" && score >= 80;
      return {
        agentKey: "sage",
        kind: isCelebration ? "celebrate" : "play_work",
        summary:
          typeof score === "number"
            ? `Scored a lead at ${Math.round(score)}/100`
            : "Scoring a new lead",
        refTable: payload.table,
        refId: stringField(row, "id") ?? stringField(row, "lead_id"),
        ts,
      };
    }

    case "contact_validations": {
      const verdict = stringField(row, "verdict") ?? stringField(row, "status");
      const passed = verdict === "valid" || verdict === "deliverable";
      return {
        agentKey: "reef",
        kind: passed ? "play_work" : "alert",
        summary: passed
          ? "Contact validated — clear to send"
          : `Contact flagged: ${verdict ?? "unknown"}`,
        refTable: "contact_validations",
        refId: stringField(row, "id"),
        ts,
      };
    }

    case "cold_email_jobs": {
      const status = stringField(row, "status");
      if (payload.eventType === "INSERT" || status === "running") {
        return {
          agentKey: "onyx",
          kind: "walk_to_work",
          summary: "Dispatching cold email batch",
          refTable: "cold_email_jobs",
          refId: stringField(row, "id"),
          workTile: AGENT_BY_KEY.onyx?.workDesk,
          ts,
        };
      }
      if (status === "completed") {
        return {
          agentKey: "onyx",
          kind: "celebrate",
          summary: "Cold email batch sent",
          refTable: "cold_email_jobs",
          refId: stringField(row, "id"),
          ts,
        };
      }
      return null;
    }

    case "outreach_log": {
      // Onyx logs every send. Don't celebrate — just play_work.
      return {
        agentKey: "onyx",
        kind: "play_work",
        summary: "Logged outreach attempt",
        refTable: "outreach_log",
        refId: stringField(row, "id"),
        ts,
      };
    }

    case "news_triggers": {
      return {
        agentKey: "nova",
        kind: payload.eventType === "INSERT" ? "alert" : "play_work",
        summary:
          stringField(row, "headline") ??
          stringField(row, "title") ??
          "New news trigger detected",
        refTable: "news_triggers",
        refId: stringField(row, "id"),
        ts,
      };
    }

    case "scheduled_posts":
    case "content_calendar": {
      const status = stringField(row, "status");
      if (status === "published" || status === "posted") {
        return {
          agentKey: "casper",
          kind: "celebrate",
          summary: "Content published",
          refTable: payload.table,
          refId: stringField(row, "id"),
          ts,
        };
      }
      return {
        agentKey: "casper",
        kind: "play_work",
        summary: "Scheduling content",
        refTable: payload.table,
        refId: stringField(row, "id"),
        ts,
      };
    }

    case "thumbnail_jobs": {
      const status = stringField(row, "status");
      if (status === "completed") {
        return {
          agentKey: "pixel",
          kind: "celebrate",
          summary: "Thumbnail rendered",
          refTable: "thumbnail_jobs",
          refId: stringField(row, "id"),
          ts,
        };
      }
      return {
        agentKey: "pixel",
        kind: "play_work",
        summary: "Painting a thumbnail",
        refTable: "thumbnail_jobs",
        refId: stringField(row, "id"),
        ts,
      };
    }

    case "ad_optimization_runs": {
      return {
        agentKey: "maven",
        kind: "play_work",
        summary: "Running ad optimisation pass",
        refTable: "ad_optimization_runs",
        refId: stringField(row, "id"),
        ts,
      };
    }

    case "trinity_actions":
    case "trinity_proposals": {
      const status = stringField(row, "status");
      if (status === "approved" || status === "executed") {
        return {
          agentKey: "aria",
          kind: "celebrate",
          summary: "Trinity action executed",
          refTable: payload.table,
          refId: stringField(row, "id"),
          ts,
        };
      }
      return {
        agentKey: "aria",
        kind: "play_work",
        summary: "Drafting a Trinity proposal",
        refTable: payload.table,
        refId: stringField(row, "id"),
        ts,
      };
    }

    case "agent_activity_events": {
      // Direct events emitted by producers — already include agent_key
      // and a pre-baked summary. Trust them.
      const agentKey = stringField(row, "agent_key");
      if (!agentKey || !(agentKey in AGENT_BY_KEY)) return null;
      const summary = stringField(row, "summary") ?? "Working...";
      const eventType = stringField(row, "event_type") ?? "play_work";
      return {
        agentKey: agentKey as AgentKey,
        kind: mapDirectEventKind(eventType),
        summary,
        refTable: stringField(row, "ref_table") ?? "agent_activity_events",
        refId: stringField(row, "ref_id"),
        ts,
      };
    }

    default:
      return null;
  }
}

/**
 * Map a textual event_type stored on agent_activity_events to one of
 * the four animation kinds. Unknown types fall back to `play_work` so
 * future producers don't need a UI bump to surface in the office.
 */
function mapDirectEventKind(eventType: string): AgentAnimationKind {
  if (
    eventType.includes("celebrate") ||
    eventType.endsWith("_completed") ||
    eventType.endsWith("_published")
  ) {
    return "celebrate";
  }
  if (eventType.includes("alert") || eventType.includes("error")) {
    return "alert";
  }
  if (eventType.includes("walk") || eventType.includes("dispatch")) {
    return "walk_to_work";
  }
  return "play_work";
}

function stringField(row: Record<string, unknown>, key: string): string | undefined {
  const v = row[key];
  return typeof v === "string" ? v : undefined;
}

function numberField(row: Record<string, unknown>, key: string): number | undefined {
  const v = row[key];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
