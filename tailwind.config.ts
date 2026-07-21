import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        bgPrimary: "var(--bg-primary)",
        bgSecondary: "var(--bg-secondary)",
        bgTertiary: "var(--bg-tertiary)",
        textPrimary: "var(--text-primary)",
        textSecondary: "var(--text-secondary)",
        textMuted: "var(--text-muted)",
        borderColor: "var(--border-color)",
        kolia: {
          ink: "#102033",
          midnight: "#0A1422",
          green: "#0F8C6F",
          mint: "#DFF4ED",
          gold: "#C89A2D",
          amber: "#FFF5D8",
          line: "#DCE5EA"
        }
      },
      boxShadow: {
        soft: "0 18px 55px rgba(16, 32, 51, 0.05)"
      }
    }
  },
  plugins: []
};

export default config;
