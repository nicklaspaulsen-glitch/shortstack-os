import { Clock } from "@phosphor-icons/react";


export interface CronEntry {
  path: string;
  schedule: string;
  nextRun: string;
  lastRun: string | null;
}

interface CronCalendarProps {
  entries: CronEntry[] | null;
}

export default function CronCalendar({ entries }: CronCalendarProps) {
  if (!entries) {
    return (
      <div className=" border border-border-subtle bg-surface p-4">
        <h2 className="text-xs font-bold mb-3 text-text-primary">Cron job calendar</h2>
        <p className="text-[11px] text-text-muted">Unavailable</p>
      </div>
    );
  }

  return (
    <div className=" border border-border-subtle bg-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={13} className="text-text-muted" />
        <h2 className="text-xs font-bold text-text-primary">Cron job calendar</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-text-muted border-b border-border-subtle">
              <th className="text-left pb-1.5 font-medium">Path</th>
              <th className="text-left pb-1.5 font-medium">Schedule</th>
              <th className="text-left pb-1.5 font-medium">Next run (approx)</th>
              <th className="text-left pb-1.5 font-medium">Last run</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.path} className="border-t border-border-subtle/50 hover:bg-surface-light transition-colors">
                <td className="py-1.5 font-mono text-text-primary pr-4">{entry.path}</td>
                <td className="py-1.5 font-mono text-text-muted pr-4">{entry.schedule}</td>
                <td className="py-1.5 text-text-muted pr-4">{entry.nextRun}</td>
                <td className="py-1.5 text-text-muted">
                  {entry.lastRun ?? <span className="text-text-muted/50">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
