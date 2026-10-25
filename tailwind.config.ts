import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'
import plugin from 'tailwindcss/plugin'
import defaultColors from 'tailwindcss/colors'

/**
 * The app (everything inside AppShell) was designed dark. Instead of rewriting
 * thousands of classes, its colors are CSS variables: `:root` keeps Tailwind's
 * real palette (public pages), and `.app-theme` swaps in a light palette.
 * `.theme-dark` restores the dark palette for media overlays and solid color buttons.
 */
type Shade = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950'
const SHADES: Shade[] = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
const ACCENT_SCALES = [
  'emerald', 'amber', 'rose', 'red', 'sky', 'orange', 'blue', 'cyan', 'purple',
  'yellow', 'pink', 'indigo', 'green', 'violet', 'teal', 'lime', 'fuchsia',
] as const
// Dark-designed accents: light text (300/400) becomes dark, deep tints (900/950) become pale.
const LIGHT_ACCENT_SHADE: Record<Shade, Shade> = {
  '50': '950', '100': '900', '200': '900', '300': '800', '400': '700', '500': '500',
  '600': '600', '700': '300', '800': '200', '900': '100', '950': '50',
}
// zinc runs light-to-dark here: zinc-950 page backgrounds become white, zinc-400 text a warm grey.
const LIGHT_ZINC: Record<string, string> = {
  '50': '#0c0a09', '100': '#1c1917', '200': '#292524', '300': '#44403c', '400': '#57534e',
  '500': '#78716c', '600': '#a8a29e', '700': '#d6d0c6', '750': '#ddd7cd', '800': '#e7e2d9',
  '850': '#efebe4', '900': '#f4f1ec', '950': '#ffffff',
}
const DARK_ZINC: Record<string, string> = { ...defaultColors.zinc, '750': '#323238', '850': '#1f1f23' }
const BG_TOKENS: Record<string, [dark: string, light: string]> = {
  base: ['#09090b', '#FAF8F5'],
  surface: ['#121215', '#FFFFFF'],
  elevated: ['#18181b', '#FFFFFF'],
  hover: ['#1f1f23', '#F3EFE9'],
  border: ['#27272a', '#E5E0D8'],
  'border-subtle': ['#1f1f23', '#EEEAE3'],
  'border-strong': ['#3f3f46', '#D3CBBF'],
}

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
const ref = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`
const scaleRefs = (scale: string, shades: string[]) =>
  Object.fromEntries(shades.map((s) => [s, ref(`${scale}-${s}`)]))

const darkVars: Record<string, string> = { '--c-white': rgb('#ffffff') }
const lightVars: Record<string, string> = { '--c-white': rgb('#18181b') }
for (const [s, hex] of Object.entries(DARK_ZINC)) darkVars[`--c-zinc-${s}`] = rgb(hex)
for (const [s, hex] of Object.entries(LIGHT_ZINC)) lightVars[`--c-zinc-${s}`] = rgb(hex)
for (const scale of ACCENT_SCALES) {
  for (const s of SHADES) {
    darkVars[`--c-${scale}-${s}`] = rgb(defaultColors[scale][s])
    lightVars[`--c-${scale}-${s}`] = rgb(defaultColors[scale][LIGHT_ACCENT_SHADE[s]])
  }
}
for (const [name, [dark, light]] of Object.entries(BG_TOKENS)) {
  darkVars[`--c-bg-${name}`] = rgb(dark)
  lightVars[`--c-bg-${name}`] = rgb(light)
}

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
        white: ref('white'),
        // Includes the intermediate 750/850 steps
        zinc: scaleRefs('zinc', Object.keys(DARK_ZINC)),
        ...Object.fromEntries(ACCENT_SCALES.map((scale) => [scale, scaleRefs(scale, SHADES)])),
        bg: scaleRefs('bg', Object.keys(BG_TOKENS)),
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
  plugins: [
    tailwindcssAnimate,
    plugin(({ addBase }) => addBase({ ':root': darkVars, '.app-theme': lightVars, '.theme-dark': darkVars })),
  ],
}

export default config
