import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // «דיו ואות» — bone paper, klaf cards, ink text
        paper: '#F5F2EB',
        card: '#FFFDF8',
        ink: {
          DEFAULT: '#12151D',
          surface: '#1A1F2A',
        },
        muted: '#6F6C64',
        line: '#E5E0D4',
        // brand = ink-blue ramp (primary actions, dark chrome)
        brand: {
          50: '#F4F5F7',
          100: '#E6E8EC',
          200: '#C7CBD4',
          300: '#9AA1AF',
          400: '#5A6170',
          500: '#3E4453',
          600: '#2C3140',
          700: '#232836',
          800: '#1A1F2A',
          900: '#161A24',
          950: '#12151D',
        },
        // copper = vermilion ramp (the single accent)
        copper: {
          50: '#FDF1EC',
          100: '#FBE3D9',
          200: '#F6C4B0',
          300: '#EF9D7E',
          400: '#EA7A52',
          500: '#E4572E',
          600: '#C9481F',
          700: '#A83A18',
          800: '#862E13',
          900: '#6B2510',
        },
        ok: {
          DEFAULT: '#1E7A4C',
          soft: '#E3F6EC',
        },
        danger: {
          DEFAULT: '#B3382C',
          soft: '#FBEDEA',
          line: '#EAD3CF',
        },
        warn: {
          DEFAULT: '#A16207',
          soft: '#FBF3E2',
          line: '#EAD9AE',
        },
        live: '#2FBF71',
        coin: '#D9A441',
        seat: '#C9C4B6',
      },
      fontFamily: {
        display: ['var(--font-frank)', 'serif'],
        body: ['var(--font-heebo)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,18,10,0.05), 0 4px 16px -8px rgba(20,18,10,0.08)',
        lift: '0 2px 4px rgba(20,18,10,0.06), 0 12px 32px -12px rgba(20,18,10,0.16)',
        modal: '0 8px 40px -8px rgba(20,18,10,0.28)',
        cta: '0 6px 18px rgba(228,87,46,0.35)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        'pulse-live': {
          '0%': { boxShadow: '0 0 0 0 rgba(47,191,113,0.55)' },
          '70%': { boxShadow: '0 0 0 9px rgba(47,191,113,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(47,191,113,0)' },
        },
        'pulse-amber': {
          '0%': { boxShadow: '0 0 0 0 rgba(217,164,65,0.55)' },
          '70%': { boxShadow: '0 0 0 9px rgba(217,164,65,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(217,164,65,0)' },
        },
      },
      animation: {
        'pulse-live': 'pulse-live 2.4s infinite',
        'pulse-amber': 'pulse-amber 2.4s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
