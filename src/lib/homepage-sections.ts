import { he } from '@/lib/he';

export type HomepageSectionItem = {
  key: string;
  icon: string;
  label: string;
  description: string;
  href: (slug: string) => string;
};

export const HOMEPAGE_SECTIONS: HomepageSectionItem[] = [
  {
    key: 'welcome',
    icon: '👋',
    label: he.homepageWelcome,
    description: he.homepageSectionWelcomeDesc,
    href: (slug) => `/t/${slug}/admin/homepage/welcome`,
  },
  {
    key: 'announcements',
    icon: '📢',
    label: he.homepageAnnouncements,
    description: he.homepageSectionAnnouncementsDesc,
    href: (slug) => `/t/${slug}/admin/homepage/announcements`,
  },
  {
    key: 'sections',
    icon: '🧩',
    label: he.homepageSections,
    description: he.homepageSectionSectionsDesc,
    href: (slug) => `/t/${slug}/admin/homepage/sections`,
  },
  {
    key: 'style',
    icon: '🎨',
    label: he.homepageStyle,
    description: he.homepageSectionStyleDesc,
    href: (slug) => `/t/${slug}/admin/homepage/style`,
  },
];

export function findHomepageSection(key: string): HomepageSectionItem | undefined {
  return HOMEPAGE_SECTIONS.find((s) => s.key === key);
}
