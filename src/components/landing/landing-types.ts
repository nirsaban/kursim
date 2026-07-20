import type { CourseMarketing } from '@/lib/validation/marketing';
import type { LandingTheme } from '@/lib/landing-themes';

export interface LandingModule {
  id: string;
  title: string;
  lessons: { id: string; title: string; durationSec: number | null }[];
}

export interface LandingReview {
  id: string;
  rating: number;
  text: string;
  name: string;
}

export interface LandingGalleryItem {
  kind: 'IMAGE' | 'VIDEO' | 'BEFORE_AFTER';
  url: string;
  afterUrl: string | null;
  caption: string;
}

export interface LandingSalePartner {
  id: string;
  title: string;
  description: string | null;
  landingPublished: boolean;
}

/** Everything a landing template needs to render — shared across all templates. */
export interface LandingProps {
  slug: string;
  tenantName: string;
  sessionLimit: number;
  modules: LandingModule[];
  m: CourseMarketing;
  theme: LandingTheme;
  previewMode: boolean;
  headline: string;
  ctaHref: string;
  ctaText: string;
  ctaExternal: boolean;
  externalProps: { target?: '_blank'; rel?: 'noopener noreferrer' };
  cta: (extra?: string) => React.ReactNode;
  trustBullets: string[];
  lessonCount: number;
  reviews: LandingReview[];
  enrollCount: number;
  gallery: LandingGalleryItem[];
  galleryRest: LandingGalleryItem[];
  heroMedia: LandingGalleryItem | null;
  totalHours: number | null;
  avgRating: number | null;
  cinematic: { framesBaseUrl: string; frameCount: number; posterUrl: string } | null;
  showSale: boolean;
  salePartner: LandingSalePartner | null;
  salePartnerCoverUrl: string | null;
  saleHref: string;
  saleExternalProps: { target?: '_blank'; rel?: 'noopener noreferrer' };
}
