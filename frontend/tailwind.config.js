/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      spacing: {
        18: "4.5rem",
        68: "17rem",
      },
      colors: {
        obsidian: {
          app: "#070b14",
          surface: "#0d1322",
          elevated: "#121a2d",
        },
      },
    },
  },
  plugins: [],
};
