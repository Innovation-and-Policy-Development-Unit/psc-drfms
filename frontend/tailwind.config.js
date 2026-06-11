/** @type {import('tailwindcss').Config} */

// TailAdmin gray palette — mapped onto both `gray` and `slate` so the whole
// app adopts the TailAdmin neutral tones without per-file rewrites.
const tailadminGray = {
  25:  '#fcfcfd',
  50:  '#f9fafb',
  100: '#f2f4f7',
  200: '#e4e7ec',
  300: '#d0d5dd',
  400: '#98a2b3',
  500: '#667085',
  600: '#475467',
  700: '#344054',
  800: '#1d2939',
  900: '#101828',
  950: '#0c111d',
};

// Preset-driven primary (kept from DRFMS theming system — values come from
// the --p-* CSS variables so the Settings color presets keep working).
const presetPrimary = {
  50:  'rgb(var(--p-50)  / <alpha-value>)',
  100: 'rgb(var(--p-100) / <alpha-value>)',
  200: 'rgb(var(--p-200) / <alpha-value>)',
  300: 'rgb(var(--p-300) / <alpha-value>)',
  400: 'rgb(var(--p-400) / <alpha-value>)',
  500: 'rgb(var(--p-500) / <alpha-value>)',
  600: 'rgb(var(--p-600) / <alpha-value>)',
  700: 'rgb(var(--p-700) / <alpha-value>)',
  800: 'rgb(var(--p-800) / <alpha-value>)',
  900: 'rgb(var(--p-900) / <alpha-value>)',
};

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gray: tailadminGray,
        slate: tailadminGray,
        primary: presetPrimary,
        brand: presetPrimary,
        'blue-light': {
          25:  '#f5fbff',
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#b9e6fe',
          300: '#7cd4fd',
          400: '#36bffa',
          500: '#0ba5ec',
          600: '#0086c9',
          700: '#026aa2',
          800: '#065986',
          900: '#0b4a6f',
        },
        success: {
          25:  '#f6fef9',
          50:  '#ecfdf3',
          100: '#d1fadf',
          200: '#a6f4c5',
          300: '#6ce9a6',
          400: '#32d583',
          500: '#12b76a',
          600: '#039855',
          700: '#027a48',
          800: '#05603a',
          900: '#054f31',
        },
        error: {
          25:  '#fffbfa',
          50:  '#fef3f2',
          100: '#fee4e2',
          200: '#fecdca',
          300: '#fda29b',
          400: '#f97066',
          500: '#f04438',
          600: '#d92d20',
          700: '#b42318',
          800: '#912018',
          900: '#7a271a',
        },
        warning: {
          25:  '#fffcf5',
          50:  '#fffaeb',
          100: '#fef0c7',
          200: '#fedf89',
          300: '#fec84b',
          400: '#fdb022',
          500: '#f79009',
          600: '#dc6803',
          700: '#b54708',
          800: '#93370d',
          900: '#7a2e0e',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        serif: ['IBM Plex Serif', 'Georgia', 'serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        registry: 'var(--radius-sm)',
        'registry-md': 'var(--radius-md)',
      },
      transitionTimingFunction: {
        registry: 'var(--ease-out-expo)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
      },
      zIndex: {
        1: '1',
        9: '9',
        99: '99',
        999: '999',
        9999: '9999',
        99999: '99999',
      },
      animation: {
        'registry-in': 'registry-fade-in var(--duration-normal) var(--ease-out-expo) forwards',
      },
      keyframes: {
        'registry-fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
