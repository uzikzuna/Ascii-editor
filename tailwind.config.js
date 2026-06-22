/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          bg: "rgb(var(--theme-bg) / <alpha-value>)",
          panel: "rgb(var(--theme-panel) / <alpha-value>)",
          border: "rgb(var(--theme-border) / <alpha-value>)",
          text: "rgb(var(--theme-text) / <alpha-value>)",
          muted: "rgb(var(--theme-muted) / <alpha-value>)",
          accent: "rgb(var(--theme-accent) / <alpha-value>)",
          accentGlow: "rgba(var(--theme-accent-glow), <alpha-value>)",
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['"Outfit"', '"Inter"', 'sans-serif'],
      },
      boxShadow: {
        'neon': '0 0 15px rgba(var(--theme-accent-glow), 0.3)',
        'neon-strong': '0 0 25px rgba(var(--theme-accent-glow), 0.5), 0 0 10px rgba(var(--theme-accent-glow), 0.3)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      backgroundImage: {
        'gradient-glass': 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
      }
    },
  },
  plugins: [],
}
