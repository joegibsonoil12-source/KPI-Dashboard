/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#21253F",   // navy from your logo
          secondary: "#B6BE82", // green from your logo
        },
      },
      borderRadius: { "2xl": "1rem" },
    },
  },
  plugins: [],
};
