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
      <div className=" border border-border-subtle bg-surface p-4">
        <h2 className="text-xs font-bold mb-3 text-text-primary">DB row counts</h2>
        <p className="text-[11px] text-text-muted">Unavailable</p>
      </div>
    );
  }

  return (
    <div className=" border border-border-subtle bg-surface p-4">
      <h2 className="text-xs font-bold mb-3 text-text-primary">DB row counts</h2>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-text-muted border-b border-border-subtle">
            <th className="text-left pb-1.5 font-medium">Table</th>
            <th className="text-right pb-1.5 font-medium">Rows</th>
          </tr>
        </thead>
        <tbody>
          {counts.map(({ table, count }) => (
            <tr key={table} className="border-t border-border-subtle/50">
              <td className="py-1.5 font-mono text-text-primary">{table}</td>
              <td className="py-1.5 text-right font-mono text-text-muted">
                {count === null ? "—" : count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
