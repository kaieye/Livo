/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography'

export default {
  content: [
    './src/renderer/src/**/*.{js,ts,jsx,tsx}',
    './src/renderer/index.html',
    './src/web/**/*.{js,ts,jsx,tsx}',
    './src/web/index.html',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
          hover: 'var(--color-accent-hover)',
          light: 'var(--color-accent-soft)',
          text: 'var(--color-accent-text)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          secondary: 'rgb(var(--color-surface-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-surface-tertiary) / <alpha-value>)',
          elevated: 'rgb(var(--color-elevated) / <alpha-value>)',
          dark: 'rgb(var(--color-surface) / <alpha-value>)',
          'dark-secondary':
            'rgb(var(--color-surface-secondary) / <alpha-value>)',
          'dark-tertiary': 'rgb(var(--color-surface-tertiary) / <alpha-value>)',
        },
        elevated: 'rgb(var(--color-elevated) / <alpha-value>)',
        text: {
          DEFAULT: 'rgb(var(--color-text) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary-rgb) / <alpha-value>)',
          tertiary: 'rgb(var(--color-text-tertiary-rgb) / <alpha-value>)',
          'dark-primary': 'rgb(var(--color-text) / <alpha-value>)',
          'dark-secondary':
            'rgb(var(--color-text-secondary-rgb) / <alpha-value>)',
        },
        sidebar: {
          DEFAULT: 'rgb(var(--color-sidebar) / <alpha-value>)',
          dark: 'rgb(var(--color-sidebar) / <alpha-value>)',
          hover: 'rgb(var(--color-sidebar-hover) / <alpha-value>)',
          'dark-hover': 'rgb(var(--color-sidebar-hover) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          dark: 'rgb(var(--color-border) / <alpha-value>)',
        },
        divider: 'rgb(var(--color-divider) / <alpha-value>)',
        'tabbar-inactive': 'var(--color-tabbar-inactive)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            img: { borderRadius: '0.5rem' },
            a: { color: '#FF5C00', textDecoration: 'none' },
            'a:hover': { textDecoration: 'underline' },
          },
        },
      },
    },
  },
  plugins: [typography],
}
