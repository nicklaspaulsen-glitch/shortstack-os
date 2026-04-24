"use client";

/**
 * NotificationSettings — the static list of event notifications that
 * fire to Telegram + Slack. Lazy-loaded because it's secondary content
 * and keeps the main settings bundle slimmer.
 *
 * No state or handlers needed — the list is literal. When we wire up
 * per-channel toggles we'll extend the props shape, not touch the
 * parent page.
 */

export default function NotificationSettings() {
  const events: Array<{ event: string; enabled: boolean }> = [
    { event: "Daily morning brief", enabled: true },
    { event: "Call booked from cold call", enabled: true },
    { event: "DM reply received", enabled: true },
    { event: "New deal closed", enabled: true },
    { event: "Content published", enabled: true },
    { event: "System integration down", enabled: true },
    { event: "New client onboarded", enabled: true },
    { event: "Invoice paid", enabled: true },
    { event: "Trinity action completed", enabled: true },
  ];

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="section-header">Telegram Notifications</h3>
        <div className="space-y-3 text-sm">
          {events.map((n, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border0 last:border-0">
              <span>{n.event}</span>
              <span className={n.enabled ? "text-success" : "text-muted"}>{n.enabled ? "On" : "Off"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="section-header">Slack Notifications</h3>
        <p className="text-sm text-muted">Same events sent to #shortstack-alerts channel in Slack</p>
      </div>
    </div>
  );
}
