import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Udemy-style flat system — white surfaces, charcoal-indigo text,
        // purple as the single accent. Token names are stable; values define
        // the theme.
        paper: '#FFFFFF',
        card: '#FFFFFF',
        ink: {
          DEFAULT: '#303141',
          surface: '#1D1E27',
        },
        muted: '#595C73',
        line: '#D9DBE8',
        // brand = charcoal-indigo ramp (dark chrome, footers, neutral UI)
        brand: {
          50: '#F6F7F9',
          100: '#E9EAF2',
          200: '#D1D2E0',
          300: '#9EA1B8',
          400: '#6A6E85',
          500: '#595C73',
          600: '#454857',
          700: '#303141',
          800: '#252630',
          900: '#1D1E27',
          950: '#14151F',
        },
        // copper = the accent ramp → Udemy purple (primary actions, links)
        copper: {
          50: '#F6F2FC',
          100: '#EDE5FA',
          200: '#D9C7F5',
          300: '#B187EA',
          400: '#8B4FE0',
          500: '#6D28D2',
          600: '#5B21B6',
          700: '#4B1D96',
          800: '#3B1783',
          900: '#2E1266',
        },
        ok: {
          DEFAULT: '#1D7A45',
          soft: '#ECF5EF',
        },
        danger: {
          DEFAULT: '#B32B2B',
          soft: '#FCECEA',
          line: '#F0D2CE',
        },
        warn: {
          DEFAULT: '#B4690E',
          soft: '#FCF4E8',
          line: '#EFDCBA',
        },
        live: '#2FBF71',
        coin: '#B4690E',
        seat: '#D1D2E0',
      },
      fontFamily: {
        display: ['var(--font-frank)', 'serif'],
        body: ['var(--font-heebo)', 'system-ui', 'sans-serif'],
        script: ['var(--font-script)', 'cursive'],
      },
      boxShadow: {
        // Flat system: borders carry the structure, shadows stay whisper-quiet
        card: 'none',
        lift: '0 2px 8px rgba(29, 30, 39, 0.08)',
        modal: '0 4px 28px rgba(29, 30, 39, 0.18)',
        cta: 'none',
      },
      borderRadius: {
        xl: '0.5rem',
        xl2: '0.5rem',
      },
      keyframes: {
        'pulse-live': {
          '0%': { boxShadow: '0 0 0 0 rgba(47,191,113,0.55)' },
          '70%': { boxShadow: '0 0 0 9px rgba(47,191,113,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(47,191,113,0)' },
        },
        'pulse-amber': {
          '0%': { boxShadow: '0 0 0 0 rgba(180,105,14,0.55)' },
          '70%': { boxShadow: '0 0 0 9px rgba(180,105,14,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(180,105,14,0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(4%, -6%) scale(1.08)' },
          '66%': { transform: 'translate(-5%, 4%) scale(0.95)' },
        },
        sheen: {
          '0%': { transform: 'translateX(-150%) skewX(-18deg)' },
          '100%': { transform: 'translateX(250%) skewX(-18deg)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(50%)' },
        },
        'cta-glow': {
          '0%, 100%': { boxShadow: '0 8px 22px var(--glow, rgba(109,40,210,0.30))' },
          '50%': { boxShadow: '0 8px 34px var(--glow-strong, rgba(109,40,210,0.5))' },
        },
        'badge-pulse': {
          '0%': { boxShadow: '0 0 0 0 var(--glow, rgba(109,40,210,0.4))' },
          '70%': { boxShadow: '0 0 0 10px transparent' },
          '100%': { boxShadow: '0 0 0 0 transparent' },
        },
        'gradient-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'bounce-soft': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(6px)' },
        },
      },
      animation: {
        'pulse-live': 'pulse-live 2.4s infinite',
        'pulse-amber': 'pulse-amber 2.4s infinite',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        drift: 'drift 18s ease-in-out infinite',
        'drift-slow': 'drift 26s ease-in-out infinite',
        sheen: 'sheen 2.6s ease-in-out infinite',
        rise: 'rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        marquee: 'marquee 30s linear infinite',
        'cta-glow': 'cta-glow 2.8s ease-in-out infinite',
        'badge-pulse': 'badge-pulse 2.4s infinite',
        'gradient-pan': 'gradient-pan 8s ease-in-out infinite',
        'bounce-soft': 'bounce-soft 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
