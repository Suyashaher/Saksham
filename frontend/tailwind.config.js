/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1B365D", // Primary AICTE Deep Blue
          dark: "#102A43",
          light: "#2B4C7E",
          50: "#F0F4F8",
          100: "#D9E2EC",
          200: "#BCCCDC",
          300: "#9FB3C8",
          400: "#829AB1",
          500: "#627D98",
          600: "#486581",
          700: "#334E68",
          800: "#243B53",
          900: "#1B365D",
          950: "#102A43",
        },
        accent: {
          DEFAULT: "#C28212", // Restrained Saffron Accent
          dark: "#A36B0B",
          light: "#F7C948",
          50: "#FFFBEA",
          100: "#FFF3C4",
          200: "#FCE588",
          300: "#FADB5F",
          400: "#F7C948",
          500: "#C28212",
          600: "#A36B0B",
          700: "#875608",
        },
        aicte: {
          blue: {
            50: "#F0F4F8",
            100: "#D9E2EC",
            200: "#BCCCDC",
            300: "#9FB3C8",
            400: "#829AB1",
            500: "#627D98",
            600: "#486581",
            700: "#334E68",
            800: "#243B53",
            900: "#1B365D",
            950: "#102A43",
          },
          saffron: {
            50: "#FFFBEA",
            100: "#FFF3C4",
            200: "#FCE588",
            300: "#FADB5F",
            400: "#F7C948",
            500: "#C28212",
            600: "#A36B0B",
            700: "#875608",
          },
        },
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
      },
    },
  },
  plugins: [],
};
