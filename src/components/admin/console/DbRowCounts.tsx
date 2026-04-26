interface TableCount {
  table: string;
  count: number | null;
}

interface DbRowCountsProps {
  counts: TableCount[] | null;
}

export default function DbRowCounts({ counts }: DbRowCountsProps) {
  if (!counts) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-xs font-bold mb-3 text-foreground">DB row counts</h2>
        <p className="text-[11px] text-muted">Unavailable</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-xs font-bold mb-3 text-foreground">DB row counts</h2>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-muted border-b border-border">
            <th className="text-left pb-1.5 font-medium">Table</th>
            <th className="text-right pb-1.5 font-medium">Rows</th>
          </tr>
        </thead>
        <tbody>
          {counts.map(({ table, count }) => (
            <tr key={table} className="border-t border-border/50">
              <td className="py-1.5 font-mono text-foreground">{table}</td>
              <td className="py-1.5 text-right font-mono text-muted">
                {count === null ? "—" : count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
