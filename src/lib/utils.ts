export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    new: "text-info",
    called: "text-warning",
    not_interested: "text-danger",
    booked: "text-success",
    converted: "text-gold",
    sent: "text-info",
    delivered: "text-blue-400",
    replied: "text-success",
    no_reply: "text-muted",
    bounced: "text-danger",
    pending: "text-warning",
    completed: "text-success",
    cancelled: "text-muted",
    draft: "text-muted",
    signed: "text-success",
    expired: "text-danger",
    paid: "text-success",
    overdue: "text-danger",
    active: "text-success",
    paused: "text-warning",
    healthy: "text-success",
    degraded: "text-warning",
    down: "text-danger",
    unknown: "text-muted",
    failed: "text-danger",
    published: "text-success",
    scheduled: "text-info",
    idea: "text-muted",
    scripted: "text-blue-400",
    in_production: "text-warning",
    editing: "text-orange-400",
    ready_to_publish: "text-gold",
  };
  return colors[status] || "text-white";
}

export function getStatusBgColor(status: string): string {
  const colors: Record<string, string> = {
    healthy: "bg-success/10 text-success",
    degraded: "bg-warning/10 text-warning",
    down: "bg-danger/10 text-danger",
    unknown: "bg-muted/10 text-muted",
    new: "bg-info/10 text-info",
    active: "bg-success/10 text-success",
    paid: "bg-success/10 text-success",
    overdue: "bg-danger/10 text-danger",
    published: "bg-success/10 text-success",
    failed: "bg-danger/10 text-danger",
  };
  return colors[status] || "bg-surface-light text-white";
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

export function generateId(): string {
  return crypto.randomUUID();
}
