/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx,svelte,vue}',
    './public/**/*.html',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Brand colors (Iraqi-flag-inspired, but tasteful — see src/styles/brand.css)
        brand: {
          50: '#fdf2f3',
          100: '#fce6e8',
          200: '#fbcfd4',
          300: '#f6a7af',
          400: '#ef7484',
          500: '#e5495d', // primary action red — tied to Iraqi-flag red, muted
          600: '#d12747',
          700: '#b01b3a',
          800: '#931a37',
          900: '#7d1a35',
          950: '#460919',
        },
        accent: {
          50: '#f0fbf3',
          100: '#dbf6e0',
          200: '#b9eac4',
          300: '#88d89c',
          400: '#52bd72',
          500: '#2fa356', // success / verified — Iraqi green
          600: '#218144',
          700: '#1c6738',
          800: '#19522f',
          900: '#164327',
          950: '#062313',
        },
        ink: {
          // Neutral palette
          50: '#f7f7f8',
          100: '#eeeef1',
          200: '#d8d8de',
          300: '#b6b6c0',
          400: '#8e8e9c',
          500: '#71717f',
          600: '#5b5b67',
          700: '#4a4a54',
          800: '#3f3f47',
          900: '#28282d',
          950: '#0c0c0f',
        },
      },
      fontFamily: {
        // Stack chosen for Iraqi audiences: Kurdish Sorani + Arabic Naskh + Latin
        sans: [
          'Vazirmatn',
          'IBM Plex Sans Arabic',
          'Segoe UI',
          'Roboto',
          'system-ui',
          'sans-serif',
        ],
        display: [
          'Vazirmatn',
          'Noto Naskh Arabic',
          'IBM Plex Sans Arabic',
          'system-ui',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Display sizes for hero/headlines
        'display-sm': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
        'display-md': ['3rem', { lineHeight: '3.25rem', letterSpacing: '-0.025em' }],
        'display-lg': ['3.75rem', { lineHeight: '4rem', letterSpacing: '-0.03em' }],
        'display-xl': ['4.5rem', { lineHeight: '4.75rem', letterSpacing: '-0.035em' }],
      },
      spacing: {
        // Aligned with @zoho-kurdish/tokens (4/8/12/16/24/32/48/64)
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 6px rgb(0 0 0 / 0.04)',
        ring: '0 0 0 1px rgb(0 0 0 / 0.06), 0 6px 16px rgb(0 0 0 / 0.08)',
        lift: '0 12px 32px rgb(15 23 42 / 0.08), 0 4px 12px rgb(15 23 42 / 0.05)',
      },
      maxWidth: {
        prose: '72ch',
        container: '1200px',
      },
    },
  },
  plugins: [],
};
