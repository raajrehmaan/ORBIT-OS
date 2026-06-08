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
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        success: "hsl(var(--success))",
        "success-foreground": "hsl(var(--success-foreground))",
        warning: "hsl(var(--warning))",
        "warning-foreground": "hsl(var(--warning-foreground))",
        error: "hsl(var(--error))",
        "error-foreground": "hsl(var(--error-foreground))",
        surface: "hsl(var(--surface))",
        "surface-foreground": "hsl(var(--surface-foreground))",
        destructive: "hsl(var(--destructive))",
        ring: "hsl(var(--ring))"
      },
      borderRadius: {
        sm: "calc(var(--radius) - 2px)",
        md: "var(--radius)",
        lg: "calc(var(--radius) + 2px)",
        xl: "calc(var(--radius) + 6px)"
      },
      spacing: {
        "page-x": "clamp(1rem, 3vw, 2rem)",
        "section-y": "1.5rem"
      },
      boxShadow: {
        xs: "0 1px 2px rgb(15 23 42 / 0.06)",
        soft: "0 14px 40px -24px rgb(15 23 42 / 0.35)",
        elevated: "0 22px 55px -32px rgb(15 23 42 / 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
