import { he } from '@/lib/he';

export type CourseSectionItem = {
  key: string;
  icon: string;
  label: string;
  description: string;
  href: (slug: string, courseId: string) => string;
  ownerOnly?: boolean;
};

/** The course editor's own hub: Content / Students / Marketing. */
export const COURSE_SECTIONS: CourseSectionItem[] = [
  {
    key: 'content',
    icon: '📚',
    label: he.modules,
    description: he.courseSectionContentDesc,
    href: (slug, courseId) => `/t/${slug}/admin/courses/${courseId}/content`,
  },
  {
    key: 'students',
    icon: '🧑‍🎓',
    label: he.enrollments,
    description: he.courseSectionStudentsDesc,
    href: (slug, courseId) => `/t/${slug}/admin/courses/${courseId}/students`,
    ownerOnly: true,
  },
  {
    key: 'marketing',
    icon: '💰',
    label: he.marketing,
    description: he.courseSectionMarketingDesc,
    href: (slug, courseId) => `/t/${slug}/admin/courses/${courseId}/marketing`,
  },
];

/** The Marketing tile's own sub-hub — it bundled 12+ things on one page. */
export const MARKETING_SECTIONS: CourseSectionItem[] = [
  {
    key: 'copy',
    icon: '📝',
    label: he.marketingCopyLabel,
    description: he.marketingCopyDesc,
    href: (slug, courseId) => `/t/${slug}/admin/courses/${courseId}/marketing/copy`,
  },
  {
    key: 'gallery',
    icon: '🖼️',
    label: he.marketingGalleryLabel,
    description: he.marketingGalleryDesc,
    href: (slug, courseId) => `/t/${slug}/admin/courses/${courseId}/marketing/gallery`,
  },
  {
    key: 'reviews',
    icon: '⭐',
    label: he.reviews,
    description: he.marketingReviewsDesc,
    href: (slug, courseId) => `/t/${slug}/admin/courses/${courseId}/marketing/reviews`,
  },
  {
    key: 'affiliates',
    icon: '🤝',
    label: he.affiliatesSection,
    description: he.marketingAffiliatesDesc,
    href: (slug, courseId) => `/t/${slug}/admin/courses/${courseId}/marketing/affiliates`,
  },
  {
    key: 'promotion',
    icon: '🏷️',
    label: he.saleSection,
    description: he.marketingPromotionDesc,
    href: (slug, courseId) => `/t/${slug}/admin/courses/${courseId}/marketing/promotion`,
  },
  {
    key: 'publish',
    icon: '🚀',
    label: he.marketingPublishLabel,
    description: he.marketingPublishDesc,
    href: (slug, courseId) => `/t/${slug}/admin/courses/${courseId}/marketing/publish`,
  },
  {
    key: 'style',
    icon: '🎨',
    label: he.marketingStyleLabel,
    description: he.marketingStyleDesc,
    href: (slug, courseId) => `/t/${slug}/admin/courses/${courseId}/marketing/style`,
  },
];

export function findCourseSection(key: string): CourseSectionItem | undefined {
  return COURSE_SECTIONS.find((s) => s.key === key);
}

export function findMarketingSection(key: string): CourseSectionItem | undefined {
  return MARKETING_SECTIONS.find((s) => s.key === key);
}
