export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-5 p-1">
      {/* Page header skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-surface-light rounded-xl" />
        <div className="space-y-2">
          <div className="h-5 w-48 bg-surface-light rounded-lg" />
          <div className="h-3 w-32 bg-surface-light/60 rounded" />
        </div>
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-surface-light rounded" />
              <div className="h-2.5 w-16 bg-surface-light rounded" />
            </div>
            <div className="h-7 w-20 bg-surface-light rounded-lg" />
          </div>
        ))}
      </div>

      {/* Tab bar skeleton */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface-light/50 w-fit">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 rounded-lg bg-surface-light" style={{ width: `${80 + i * 20}px` }} />
        ))}
      </div>

      {/* Content rows skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-surface-light rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-surface-light rounded" style={{ width: `${40 + Math.random() * 40}%` }} />
              <div className="h-2.5 bg-surface-light/60 rounded w-24" />
            </div>
            <div className="h-5 w-16 bg-surface-light rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
