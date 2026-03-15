/** @type {import('tailwindcss').Config} */
import typography from "@tailwindcss/typography"

export default {
  content: ["./src/renderer/src/**/*.{js,ts,jsx,tsx}", "./src/renderer/index.html", "./src/web/**/*.{js,ts,jsx,tsx}", "./src/web/index.html"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#FF5C00",
          hover: "#FF7A33",
          light: "#FFF0E6",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          secondary: "#F5F5F7",
          tertiary: "#E8E8ED",
          dark: "#1C1C1E",
          "dark-secondary": "#2C2C2E",
          "dark-tertiary": "#3A3A3C",
        },
        text: {
          DEFAULT: "#1D1D1F",
          secondary: "#6E6E73",
          tertiary: "#AEAEB2",
          "dark-primary": "#F5F5F7",
          "dark-secondary": "#A1A1A6",
        },
        sidebar: {
          DEFAULT: "#F5F5F7",
          dark: "#1C1C1E",
          hover: "#E8E8ED",
          "dark-hover": "#2C2C2E",
        },
        border: {
          DEFAULT: "#D2D2D7",
          dark: "#38383A",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "none",
            img: { borderRadius: "0.5rem" },
            a: { color: "#FF5C00", textDecoration: "none" },
            "a:hover": { textDecoration: "underline" },
          },
        },
      },
    },
  },
  plugins: [typography],
}
