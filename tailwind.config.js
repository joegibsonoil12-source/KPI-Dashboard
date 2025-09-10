/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#21253F",   // navy
          secondary: "#B6BE82"  // olive/green
        }
      }
    }
  },
  plugins: []
};
