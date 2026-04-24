/* ────────────────────────────────────────────────────────────────
 * Public barrel for the reusable Timeline primitive.
 *
 * Consumers should import from "@/components/timeline" rather than
 * the individual files so we can reorganize internals later without
 * breaking call sites.
 * ────────────────────────────────────────────────────────────────*/

export { Timeline, default } from "./Timeline";
export type { TimelineProps } from "./Timeline";
export { useTimelineHistory } from "./use-timeline-history";
export type { UseTimelineHistory } from "./use-timeline-history";
export type {
  Clip,
  TimelineClip,
  TimelineTrack,
  TimelineTrackKind,
  TimelineProject,
  TimelineHistoryEntry,
} from "./types";
