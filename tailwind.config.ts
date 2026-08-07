import type { Config } from "tailwindcss";

// Color tokens match the design mockup exactly — see /docs/design-mockup.html
// for the visual reference these map to.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fairway: {
          950: "#0B2818",
          900: "#0F3020",
        },
        surface: "#153823",
        "surface-raised": "#1B4530",
        turf: "#6FCF97",
        chalk: {
          DEFAULT: "#F4F2EA",
          dim: "#9DB8A8",
        },
        flag: "#E4572E",
        sand: "#D9A441",
      },
      fontFamily: {
        display: ["var(--font-big-shoulders)", "sans-serif"],
        body: ["var(--font-manrope)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
