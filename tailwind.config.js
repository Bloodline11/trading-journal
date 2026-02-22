/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tx: {
          bg: "var(--tx-bg)",
          panel: "var(--tx-panel)",
          border: "var(--tx-border)",
          silver: "var(--tx-silver)",
          blue: "var(--tx-blue)",
        },
      },
    },
  },
  plugins: [],
};
