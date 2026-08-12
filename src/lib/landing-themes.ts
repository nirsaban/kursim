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
  petrol: { name: 'פטרול', main: '#177A87', deep: '#0F5560', soft: '#E9F2F1', accent: '#E4572E' },
  copper: { name: 'חמרה', main: '#B0492A', deep: '#93381E', soft: '#F7E5DD', accent: '#D9A441' },
  plum: { name: 'שזיף', main: '#8A4C97', deep: '#6E3A79', soft: '#F4EBF6', accent: '#E4572E' },
  forest: { name: 'יער', main: '#3D7A4E', deep: '#2C5E3A', soft: '#EAF2EC', accent: '#D9A441' },
  midnight: { name: 'אינדיגו', main: '#5B5FA8', deep: '#45488C', soft: '#EDEEF6', accent: '#E4572E' },
  royal: { name: 'זהב מלכותי', main: '#A07B22', deep: '#7A5C15', soft: '#F8F1DE', accent: '#C9481F' },
  rose: { name: 'רוז', main: '#C2447A', deep: '#9A2F5F', soft: '#FBEAF2', accent: '#D9A441' },
  ocean: { name: 'אוקיינוס', main: '#1D6FB8', deep: '#154F86', soft: '#E7F0F9', accent: '#E4572E' },
  sunset: { name: 'שקיעה', main: '#D95B21', deep: '#AC4310', soft: '#FBEDE0', accent: '#D9A441' },
  noir: { name: 'נואר', main: '#1F242E', deep: '#12151D', soft: '#EEECE6', accent: '#D9A441' },
};

export const LANDING_EMOJI = ['🎓', '🚀', '💡', '📈', '🎨', '🎸', '🧘', '👨‍🍳', '💻', '📷', '🏋️', '✍️'];
