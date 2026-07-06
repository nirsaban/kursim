import type { LandingAccent } from '@/lib/validation/marketing';

export interface LandingTheme {
  name: string;
  /** primary surface color for hero + CTA */
  main: string;
  /** darkest shade — hero background gradients, footer */
  deep: string;
  /** tinted background for alternating sections */
  soft: string;
  /** warm contrast accent for the enroll CTA */
  accent: string;
}

export const LANDING_THEMES: Record<LandingAccent, LandingTheme> = {
  petrol: { name: 'פטרול', main: '#177A87', deep: '#0B3B42', soft: '#F0F6F7', accent: '#C26A3B' },
  copper: { name: 'נחושת', main: '#AD5527', deep: '#572A16', soft: '#FAF3EC', accent: '#12626E' },
  plum: { name: 'שזיף', main: '#7E4A8C', deep: '#43254C', soft: '#F7F2F8', accent: '#B08A3E' },
  forest: { name: 'יער', main: '#3D7A4E', deep: '#1D3B26', soft: '#F1F6F2', accent: '#B0592D' },
  midnight: { name: 'חצות', main: '#45508F', deep: '#1E2447', soft: '#F2F3F9', accent: '#C2703B' },
};

export const LANDING_EMOJI = ['🎓', '🚀', '💡', '📈', '🎨', '🎸', '🧘', '👨‍🍳', '💻', '📷', '🏋️', '✍️'];
