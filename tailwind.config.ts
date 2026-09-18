import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FAF7ED",
        paperDeep: "#F0E9D4",
        paperMid: "#F5F0E2",
        ink: "#1E2438",
        inkMid: "rgba(30,36,56,0.65)",
        inkSoft: "rgba(30,36,56,0.42)",
        cham: "#2B3A67",
        chamDeep: "#1B2444",
        chamSoft: "rgba(43,58,103,0.08)",
        nghe: "#E0972F",
        ngheDeep: "#C67D1C",
        ngheSoft: "#F3D9A9",
        ngheXsoft: "#FBF1DC",
        son: "#A8342B",
        sonSoft: "#F3DAD6",
        sonMid: "rgba(168,52,43,0.12)",
        lua: "#5D7A4B",
        luaSoft: "#DEE7D6",
        sky: "#3B7DD8",
        skySoft: "#DDEAFC",
        line: "rgba(30,36,56,0.13)",
        lineStrong: "rgba(30,36,56,0.22)"
      },
      boxShadow: {
        card: "0 2px 12px rgba(30,36,56,0.08)",
        modal: "0 8px 48px rgba(30,36,56,0.18)"
      },
      borderRadius: {
        sm2: "4px",
        md2: "8px",
        lg2: "14px",
        xl2: "20px"
      },
      fontFamily: {
        serif: ["'Times New Roman'", "Times", "serif"],
        sans: ["'Times New Roman'", "Times", "serif"],
        mono: ["'Times New Roman'", "Times", "serif"]
      }
    },
  },
  plugins: [],
};

export default config;
