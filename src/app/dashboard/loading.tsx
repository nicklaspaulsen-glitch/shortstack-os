export default function DashboardLoading() {
  return (
    <div className="fade-in space-y-5 p-1">
      {/* Hero banner skeleton — matches PageHero component */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-gold/[0.08] via-gold/[0.03] to-transparent p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gold/10 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-64 bg-white/5 rounded-lg animate-pulse" />
            <div className="h-3 w-48 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="hidden md:flex gap-2">
            <div className="h-8 w-24 bg-white/5 rounded-lg animate-pulse" />
            <div className="h-8 w-20 bg-white/5 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4 space-y-3 animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-surface-light rounded" />
              <div className="h-2.5 w-16 bg-surface-light rounded" />
            </div>
            <div className="h-7 w-20 bg-surface-light rounded-lg" />
            <div className="h-2 w-24 bg-surface-light/60 rounded" />
          </div>
        ))}
      </div>

      {/* Content rows */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-3 flex items-center gap-3 animate-pulse" style={{ animationDelay: `${80 + i * 40}ms` }}>
            <div className="w-9 h-9 bg-surface-light rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-surface-light rounded" style={{ width: `${40 + (i * 11) % 40}%` }} />
              <div className="h-2.5 bg-surface-light/60 rounded w-24" />
            </div>
            <div className="h-5 w-16 bg-surface-light rounded-full" />
          </div>
        ))}
      </div>

      {/* Subtle gold accent — gives energy instead of dead skeleton */}
      <div className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 backdrop-blur-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
        </span>
        <span className="text-[10px] text-gold font-medium">Loading...</span>
      </div>
    </div>
  );
}
