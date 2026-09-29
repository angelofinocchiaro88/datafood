import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1E3A5F",
          50: "#E8EDF3",
          100: "#D1DBE7",
          200: "#A3B7CF",
          300: "#7593B7",
          400: "#476F9F",
          500: "#1E3A5F",
          600: "#182E4C",
          700: "#122339",
          800: "#0C1726",
          900: "#060C13",
        },
        secondary: {
          DEFAULT: "#2D5016",
          50: "#EBF0E5",
          100: "#D7E1CB",
          200: "#AFC397",
          300: "#87A563",
          400: "#5F8730",
          500: "#2D5016",
          600: "#244012",
          700: "#1B300E",
          800: "#12200A",
          900: "#091006",
        },
        accent: {
          DEFAULT: "#D4A574",
          50: "#F9F3EE",
          100: "#F3E7DD",
          200: "#E7CFBB",
          300: "#DBB799",
          400: "#D4A574",
          500: "#C48B50",
          600: "#A66E3A",
          700: "#7D512B",
          800: "#54341D",
          900: "#2B1710",
        },
        background: "#FAFAF9",
        surface: "#FFFFFF",
      },
      fontFamily: {
        heading: ["Playfair Display", "serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
