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
  petrol: { name: 'פטרול', main: '#177A87', deep: '#0F5560', soft: '#EEF6F6', accent: '#6D28D2' },
  copper: { name: 'חמרה', main: '#B0492A', deep: '#93381E', soft: '#F8EEEA', accent: '#6D28D2' },
  plum: { name: 'שזיף', main: '#8A4C97', deep: '#6E3A79', soft: '#F5EFF7', accent: '#1D1E27' },
  forest: { name: 'יער', main: '#3D7A4E', deep: '#2C5E3A', soft: '#EFF6F1', accent: '#6D28D2' },
  midnight: { name: 'אינדיגו', main: '#5B5FA8', deep: '#45488C', soft: '#F0F0F8', accent: '#1D1E27' },
  royal: { name: 'זהב מלכותי', main: '#A07B22', deep: '#7A5C15', soft: '#F9F5EA', accent: '#6D28D2' },
  rose: { name: 'רוז', main: '#C2447A', deep: '#9A2F5F', soft: '#FBF0F4', accent: '#6D28D2' },
  ocean: { name: 'אוקיינוס', main: '#1D6FB8', deep: '#154F86', soft: '#EEF4FA', accent: '#6D28D2' },
  sunset: { name: 'שקיעה', main: '#D95B21', deep: '#AC4310', soft: '#FBF1E8', accent: '#6D28D2' },
  noir: { name: 'נואר', main: '#1F242E', deep: '#12151D', soft: '#F2F2F1', accent: '#6D28D2' },
};

export const LANDING_EMOJI = ['🎓', '🚀', '💡', '📈', '🎨', '🎸', '🧘', '👨‍🍳', '💻', '📷', '🏋️', '✍️'];
