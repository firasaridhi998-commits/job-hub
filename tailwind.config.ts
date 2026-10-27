import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0B0D",
        surface: "#151519",
        raised: "#1E1E24",
        accent: "#FFD400",
        "accent-hover": "#FFE14D",
        fg: "#F8F8FA",
        muted: "#A6A6B0",
        line: "#303036",
        good: "#4ADE80",
        warn: "#FBBF24",
        bad: "#F87171",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
