// Brand tokens for the mobile shell. Mirrors the web app's
// gold/blue/purple language but stays compact — only the values the
// shell actually uses.
export const theme = {
  colors: {
    bg: "#0b0d12",
    surface: "#161824",
    surfaceAlt: "#1f2233",
    border: "#2b2f44",
    text: "#f4f4f8",
    textMuted: "#a4a8c5",
    accent: "#7a5cff",
    accentSoft: "#9b85ff",
    gold: "#f4c66c",
    danger: "#ff5d6c",
    success: "#39d98a",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 9999,
  },
  font: {
    h1: 28,
    h2: 22,
    h3: 18,
    body: 15,
    small: 13,
  },
} as const;

export type Theme = typeof theme;
