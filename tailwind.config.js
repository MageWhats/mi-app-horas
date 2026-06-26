/** @type {import('tailwindcss').Config} */
module.exports = {
  // Escanea la carpeta app y components para aplicar estilos
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
}
