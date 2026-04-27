"use client";

// Small inline display: country flag + local time for a lead, derived from
// the geo-IP enrichment performed at form-submit / lead-create time.
//
// Reads from `lead.metadata.geo` (set by /api/forms/submit and /api/leads
// POST handlers). If no geo data is present, the component renders nothing
// — never falls back to a confusing default.
//
// Updates the displayed time once per minute. The Intl.DateTimeFormat call
// is cheap; we avoid setInterval if `timezone` is missing.

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export interface LeadGeoMetadata {
  country_code?: string;
  country_name?: string;
  city?: string | null;
  timezone?: string | null;
}

interface LeadLocalTimeProps {
  geo?: LeadGeoMetadata | null;
  /** Hide the country flag if you only want the time. */
  hideFlag?: boolean;
  /** Hide the city/country label if you only want the time. */
  hideLabel?: boolean;
  className?: string;
}

function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return "";
  const upper = code.toUpperCase();
  // Each ASCII letter A-Z maps to the regional indicator symbol at +127397.
  return String.fromCodePoint(
    upper.charCodeAt(0) + 127397,
    upper.charCodeAt(1) + 127397,
  );
}

function formatLocalTime(timezone: string): string | null {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    return null;
  }
}

export default function LeadLocalTime({
  geo,
  hideFlag = false,
  hideLabel = false,
  className = "",
}: LeadLocalTimeProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!geo?.timezone) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [geo?.timezone]);

  if (!geo || (!geo.country_code && !geo.timezone)) return null;

  const flag = !hideFlag && geo.country_code ? countryCodeToFlag(geo.country_code) : "";
  const localTime = geo.timezone ? formatLocalTime(geo.timezone) : null;
  const labelParts = [geo.city, geo.country_name].filter(Boolean);

  // Reference `now` so the linter knows it's used (re-renders pull the latest time).
  void now;

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${className}`}>
      {flag && <span>{flag}</span>}
      {!hideLabel && labelParts.length > 0 && (
        <span className="text-muted">{labelParts.join(", ")}</span>
      )}
      {localTime && (
        <span className="text-muted inline-flex items-center gap-0.5">
          <Clock className="w-3 h-3" />
          {localTime}
        </span>
      )}
    </span>
  );
}
