/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          light: "#0D0D0D",
          DEFAULT: "#00B8FF", // electric blue
          dark: "#181818",
          accent: "#FFD25A", // golden
        },
        accent: {
          blue: "#00B8FF",
          gold: "#FFD25A",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-poppins)",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "Noto Sans",
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "Segoe UI Symbol",
        ],
      },
      boxShadow: {
        glow: "0 0 0 2px rgba(0,184,255,0.15), 0 0 40px rgba(0,184,255,0.25)",
      },
    },
  },
  plugins: [],
}
