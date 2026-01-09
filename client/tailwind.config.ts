import type { Config } from "tailwindcss";
import { withUt } from "uploadthing/tw";


const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0F1116",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'pop-bounce': {
          '0%': { transform: 'translate(-50%, -100%) scale(0.9)', opacity: '0' },
          '50%': { transform: 'translate(-50%, 0) scale(1)', opacity: '1' },
          '70%': { transform: 'translate(-50%, -5%) scale(1.05)' },
          '100%': { transform: 'translate(-50%, -100%) scale(0.9)', opacity: '0' },
        },
        fadeInOut: {
          '0%': { opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
        scaleIn: 'scaleIn 0.3s ease-out',
        'pop-bounce': 'pop-bounce 5s ease-in-out',
        fadeInOut: 'fadeInOut 4s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('daisyui'),
  ],
};

export default withUt(config);