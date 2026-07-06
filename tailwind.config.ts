import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAF9F7',
        ink: '#201D1A',
        muted: '#6F6A63',
        line: '#E7E3DC',
        brand: {
          50: '#F2F8F9',
          100: '#DCEDEF',
          200: '#BFDEE2',
          300: '#93C6CD',
          400: '#4FA5B0',
          500: '#1E8E9C',
          600: '#177A87',
          700: '#12626E',
          800: '#0E4A53',
          900: '#0B3B42',
          950: '#082A30',
        },
        copper: {
          50: '#FBF3EE',
          100: '#F5E3D7',
          200: '#EAC5AC',
          300: '#DDA278',
          400: '#CF854F',
          500: '#C26A3B',
          600: '#AD5527',
          700: '#8F441F',
          800: '#70351A',
          900: '#572A16',
        },
        ok: '#2E7D4F',
        danger: '#B3382C',
        warn: '#A16207',
      },
      fontFamily: {
        display: ['var(--font-rubik)', 'system-ui', 'sans-serif'],
        body: ['var(--font-heebo)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(32,29,26,0.05), 0 4px 16px -8px rgba(32,29,26,0.08)',
        lift: '0 2px 4px rgba(32,29,26,0.06), 0 12px 32px -12px rgba(32,29,26,0.16)',
        modal: '0 8px 40px -8px rgba(32,29,26,0.28)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
