import { describe, it, expect } from "vitest";
import {
  cn,
  formatCurrency,
  formatDate,
  formatRelativeTime,
  getStatusColor,
  getStatusBgColor,
  truncate,
} from "@/lib/utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters out falsy values", () => {
    expect(cn("foo", false, null, undefined, "bar")).toBe("foo bar");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});

describe("formatCurrency", () => {
  it("formats USD by default", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats large numbers with commas", () => {
    expect(formatCurrency(1000000)).toBe("$1,000,000.00");
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2026-04-12T00:00:00Z");
    expect(result).toContain("Apr");
    expect(result).toContain("2026");
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date("2026-01-15"));
    expect(result).toContain("Jan");
    expect(result).toContain("2026");
  });
});

describe("formatRelativeTime", () => {
  it("returns 'just now' for recent dates", () => {
    expect(formatRelativeTime(new Date())).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000);
    expect(formatRelativeTime(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000);
    expect(formatRelativeTime(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days ago", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
    expect(formatRelativeTime(twoDaysAgo)).toBe("2d ago");
  });

  it("falls back to formatted date for old dates", () => {
    const oldDate = new Date(Date.now() - 30 * 86400000);
    const result = formatRelativeTime(oldDate);
    expect(result).not.toContain("ago");
  });
});

describe("getStatusColor", () => {
  it("returns correct color for known statuses", () => {
    expect(getStatusColor("new")).toBe("text-info");
    expect(getStatusColor("booked")).toBe("text-success");
    expect(getStatusColor("converted")).toBe("text-gold");
    expect(getStatusColor("bounced")).toBe("text-danger");
    expect(getStatusColor("pending")).toBe("text-warning");
  });

  it("returns default for unknown status", () => {
    expect(getStatusColor("nonexistent")).toBe("text-foreground");
  });
});

describe("getStatusBgColor", () => {
  it("returns correct bg color for known statuses", () => {
    expect(getStatusBgColor("healthy")).toBe("bg-success/10 text-success");
    expect(getStatusBgColor("down")).toBe("bg-danger/10 text-danger");
    expect(getStatusBgColor("overdue")).toBe("bg-danger/10 text-danger");
  });

  it("returns default for unknown status", () => {
    expect(getStatusBgColor("nonexistent")).toBe("bg-surface-light text-foreground");
  });
});

describe("truncate", () => {
  it("returns string unchanged if under max length", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates and adds ellipsis", () => {
    expect(truncate("hello world this is long", 10)).toBe("hello worl...");
  });

  it("handles exact length", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });
});
