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
  petrol: { name: 'פטרול', main: '#177A87', deep: '#0F5560', soft: '#E9F2F1', accent: '#177A87' },
  copper: { name: 'חמרה', main: '#B0492A', deep: '#93381E', soft: '#F7E5DD', accent: '#B0492A' },
  plum: { name: 'שזיף', main: '#8A4C97', deep: '#6E3A79', soft: '#F4EBF6', accent: '#8A4C97' },
  forest: { name: 'יער', main: '#3D7A4E', deep: '#2C5E3A', soft: '#EAF2EC', accent: '#3D7A4E' },
  midnight: { name: 'אינדיגו', main: '#5B5FA8', deep: '#45488C', soft: '#EDEEF6', accent: '#5B5FA8' },
};

export const LANDING_EMOJI = ['🎓', '🚀', '💡', '📈', '🎨', '🎸', '🧘', '👨‍🍳', '💻', '📷', '🏋️', '✍️'];
