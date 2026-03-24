/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primary: Green (agriculture, growth)
        primary: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#16a34a", // Main green
          600: "#15803d",
          700: "#166534",
          800: "#14532d",
          900: "#052e16",
        },
        // Accent: Gold (harvest, prosperity)
        accent: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#d4a017", // Main gold
          600: "#b8860b",
          700: "#92710c",
          800: "#78600d",
          900: "#614e12",
        },
        // Neutral: Slate (clean, modern - NO brown)
        neutral: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
        // Semantic
        success: "#16a34a",
        warning: "#d97706",
        danger: "#dc2626",
        info: "#2563eb",
      },
      fontFamily: {
        sans: ["Noto Sans Sinhala", "Noto Sans Tamil", "Inter", "sans-serif"],
        display: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
