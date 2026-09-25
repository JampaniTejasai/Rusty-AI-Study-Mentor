import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "rusty-green":            "#2E6B4C",
        "rusty-green-dark":       "#234F39",
        "rusty-green-soft":       "#E3EFE7",
        "rusty-terracotta":       "#C2562C",
        "rusty-terracotta-dark":  "#9C3F1C",
        "rusty-terracotta-soft":  "#FBE8DC",
        "rusty-sand":             "#FBF7EF",
        "rusty-cream":            "#FFFDF8",
        "rusty-border":           "#E7DECF",
        "rusty-ink":              "#2A2520",
        "rusty-muted":            "#6B6256",
        "rusty-success":          "#1A7A43",
        "rusty-success-dark":     "#176B3B",
        "rusty-success-soft":     "#E2F2E7",
        "rusty-warning":          "#C77A12",
        "rusty-warning-dark":     "#875210",
        "rusty-warning-soft":     "#FBEFD6",
        "rusty-danger":           "#C0392B",
        "rusty-danger-dark":      "#9E2C20",
        "rusty-danger-soft":      "#FBE6E3",
        "rusty-ai":               "#5B4B9E",
        "rusty-ai-dark":          "#473B7D",
        "rusty-ai-soft":          "#ECEAF7",
      },
      fontFamily: {
        sans: ["Noto Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
