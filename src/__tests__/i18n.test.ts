import { describe, it, expect, vi } from "vitest";
import { t } from "@/lib/i18n";

// Mock localStorage for server-side
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

describe("t (translation)", () => {
  it("returns English translation by default", () => {
    expect(t("dashboard", "en")).toBe("Dashboard");
  });

  it("returns Danish translation", () => {
    expect(t("dashboard", "da")).toBe("Kontrolpanel");
  });

  it("returns key if not found", () => {
    expect(t("nonexistent_key", "en")).toBe("nonexistent_key");
  });

  it("falls back to English for unknown language", () => {
    expect(t("dashboard", "fr")).toBe("Dashboard");
  });

  it("translates common actions", () => {
    expect(t("save", "en")).toBe("Save");
    expect(t("save", "da")).toBe("Gem");
    expect(t("cancel", "en")).toBe("Cancel");
    expect(t("cancel", "da")).toBe("Annuller");
  });

  it("translates status words", () => {
    expect(t("active", "en")).toBe("Active");
    expect(t("active", "da")).toBe("Aktiv");
    expect(t("completed", "da")).toBe("Faerdig");
  });
});
