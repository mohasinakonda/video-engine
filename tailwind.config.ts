import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Intermediate zinc steps (merged into default zinc palette)
        zinc: {
          750: '#323238',
          850: '#1f1f23',
        },
        bg: {
          base: '#09090b',
          surface: '#121215',
          elevated: '#18181b',
          hover: '#1f1f23',
          border: '#27272a',
          'border-subtle': '#1f1f23',
          'border-strong': '#3f3f46',
        },
        accent: {
          primary: '#ffffff',
          'primary-hover': '#e4e4e7',
          muted: '#27272a',
          purple: '#ffffff',
          'purple-light': '#e4e4e7',
          'purple-glow': 'transparent',
          cyan: '#a1a1aa',
          'cyan-glow': 'transparent',
        },
        status: {
          success: '#10b981',
          error: '#ef4444',
          warning: '#f59e0b',
          info: '#a1a1aa',
        },
      },
      // Exact equivalents of text-[9px]/[10px]/[11px] (no line-height override)
      fontSize: {
        '3xs': '9px',
        '2xs': '10px',
        xxs: '11px',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'Inter', 'system-ui', 'sans-serif'],
        dm: ['var(--font-dm-sans)', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
