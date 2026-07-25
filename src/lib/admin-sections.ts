import { he } from '@/lib/he';

export type AdminSectionItem = {
  key: string;
  icon: string;
  label: string;
  description: string;
  href: (slug: string) => string;
  liveDot?: boolean;
};

export type AdminSection = {
  key: string;
  icon: string;
  label: string;
  description: string;
  href: (slug: string) => string;
  items: AdminSectionItem[];
};

/**
 * The single source of truth for the owner's 4-part navigation: the big
 * tiles on /admin, the sub-tiles on each /admin/hub/[section] page, and the
 * collapsed top navbar all read from this list.
 */
export const ADMIN_SECTIONS: AdminSection[] = [
  {
    key: 'courses',
    icon: '📚',
    label: he.courses,
    description: he.adminSectionCoursesDesc,
    href: (slug) => `/t/${slug}/admin/hub/courses`,
    items: [
      {
        key: 'courses-list',
        icon: '📋',
        label: he.courses,
        description: he.adminItemCoursesListDesc,
        href: (slug) => `/t/${slug}/admin/courses`,
      },
      {
        key: 'courses-new',
        icon: '➕',
        label: he.newCourseWizard,
        description: he.adminItemCoursesNewDesc,
        href: (slug) => `/t/${slug}/admin/courses/new`,
      },
    ],
  },
  {
    key: 'students',
    icon: '👥',
    label: he.students,
    description: he.adminSectionStudentsDesc,
    href: (slug) => `/t/${slug}/admin/hub/students`,
    items: [
      {
        key: 'students',
        icon: '🧑‍🎓',
        label: he.students,
        description: he.adminItemStudentsDesc,
        href: (slug) => `/t/${slug}/admin/students`,
      },
      {
        key: 'sessions',
        icon: '📡',
        label: he.sessions,
        description: he.adminItemSessionsDesc,
        href: (slug) => `/t/${slug}/admin/sessions`,
        liveDot: true,
      },
      {
        key: 'community',
        icon: '💬',
        label: he.community,
        description: he.adminItemCommunityDesc,
        href: (slug) => `/t/${slug}/community`,
      },
    ],
  },
  {
    key: 'marketing',
    icon: '💰',
    label: he.navMarketing,
    description: he.adminSectionMarketingDesc,
    href: (slug) => `/t/${slug}/admin/hub/marketing`,
    items: [
      {
        key: 'payments',
        icon: '💳',
        label: he.payments,
        description: he.adminItemPaymentsDesc,
        href: (slug) => `/t/${slug}/admin/payments`,
      },
      {
        key: 'broadcasts',
        icon: '📣',
        label: he.broadcasts,
        description: he.adminItemBroadcastsDesc,
        href: (slug) => `/t/${slug}/admin/broadcasts`,
      },
      {
        key: 'access-codes',
        icon: '🎟️',
        label: he.accessCodes,
        description: he.adminItemAccessCodesDesc,
        href: (slug) => `/t/${slug}/admin/access-codes`,
      },
      {
        key: 'analytics',
        icon: '📈',
        label: he.analytics,
        description: he.adminItemAnalyticsDesc,
        href: (slug) => `/t/${slug}/admin/analytics`,
      },
    ],
  },
  {
    key: 'settings',
    icon: '⚙️',
    label: he.settings,
    description: he.adminSectionSettingsDesc,
    href: (slug) => `/t/${slug}/admin/hub/settings`,
    items: [
      {
        key: 'homepage',
        icon: '🏠',
        label: he.homepageBuilder,
        description: he.adminItemHomepageDesc,
        href: (slug) => `/t/${slug}/admin/homepage`,
      },
      {
        key: 'whatsapp',
        icon: '📱',
        label: he.whatsappTitle,
        description: he.adminItemWhatsappDesc,
        href: (slug) => `/t/${slug}/admin/whatsapp`,
      },
      {
        key: 'settings',
        icon: '🔧',
        label: he.settings,
        description: he.adminItemSettingsDesc,
        href: (slug) => `/t/${slug}/admin/settings`,
      },
    ],
  },
];

export function findAdminSection(key: string): AdminSection | undefined {
  return ADMIN_SECTIONS.find((s) => s.key === key);
}
