import type { CourseMarketing } from '@/lib/validation/marketing';
import type { LandingTheme } from '@/lib/landing-themes';
import type { Socials } from '@/lib/validation/links';

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

export interface LandingResultItem {
  url: string;
  caption: string;
}

export interface LandingSalePartner {
  id: string;
  title: string;
  description: string | null;
  landingPublished: boolean;
}

export interface LandingCollectionCourse {
  id: string;
  title: string;
  description: string;
  emoji: string;
  coverUrl: string | null;
  outcomes: string[];
  lessonCount: number;
  totalHours: number | null;
  priceLabel: string;
  strikeLabel: string | null;
  /** null → nothing to link to (unpriced and unpublished) */
  ctaHref: string | null;
  ctaText: string;
  detailsHref: string | null;
  addons: Array<{ id: string; title: string; priceLabel: string; href: string }>;
  /** The course whose content the page is built from. */
  isFront: boolean;
}

/** Combined landing page: the course picker rendered near the top of the page. */
export interface LandingCollection {
  title: string;
  subtitle: string;
  courses: LandingCollectionCourse[];
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
  /** The CTA leads to a real payment — drives the padlock and the trust line. */
  paid: boolean;
  /** What to show next to the CTA: the owner's wording, else the real price. */
  priceLabel: string;
  externalProps: { target?: '_blank'; rel?: 'noopener noreferrer' };
  cta: (extra?: string) => React.ReactNode;
  trustBullets: string[];
  lessonCount: number;
  reviews: LandingReview[];
  enrollCount: number;
  gallery: LandingGalleryItem[];
  galleryRest: LandingGalleryItem[];
  results: LandingResultItem[];
  /** Coarse device class from the request UA — lets the carousel size slides during SSR. */
  deviceType: 'mobile' | 'tablet' | 'desktop';
  heroMedia: LandingGalleryItem | null;
  totalHours: number | null;
  avgRating: number | null;
  cinematic: { framesBaseUrl: string; frameCount: number; posterUrl: string } | null;
  showSale: boolean;
  salePartner: LandingSalePartner | null;
  salePartnerCoverUrl: string | null;
  saleHref: string;
  saleExternalProps: { target?: '_blank'; rel?: 'noopener noreferrer' };
  /** School-wide social channels, rendered in the footer. */
  socials: Socials;
  /** Set on combined (multi-course) pages — templates render the course picker at #courses. */
  collection: LandingCollection | null;
}
