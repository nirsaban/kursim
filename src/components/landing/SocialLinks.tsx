import Icon, { type IconName } from '@/components/ui/Icon';
import { he } from '@/lib/he';
import { socialEntries, type Socials } from '@/lib/validation/links';

const SOCIAL_ICON: Record<keyof Socials, IconName> = {
  whatsapp: 'whatsapp',
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
  youtube: 'youtube',
  linkedin: 'linkedin',
  website: 'globe',
  email: 'mail',
};

const SOCIAL_LABEL: Record<keyof Socials, string> = {
  whatsapp: he.socialWhatsapp,
  instagram: he.socialInstagram,
  facebook: he.socialFacebook,
  tiktok: he.socialTiktok,
  youtube: he.socialYoutube,
  linkedin: he.socialLinkedin,
  website: he.socialWebsite,
  email: he.socialEmail,
};

/**
 * Row of circular social-icon buttons. Colors come from the surrounding
 * theme via currentColor; pass `className` on the row for tone.
 */
export default function SocialLinks({
  socials,
  className = '',
  buttonClassName = 'border-line hover:border-ink/40 text-muted hover:text-ink',
  size = 18,
}: {
  socials: Socials;
  className?: string;
  buttonClassName?: string;
  size?: number;
}) {
  const entries = socialEntries(socials);
  if (entries.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center justify-center gap-2.5 ${className}`}>
      {entries.map((e) => (
        <a
          key={e.kind}
          href={e.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={SOCIAL_LABEL[e.kind]}
          title={SOCIAL_LABEL[e.kind]}
          className={`w-11 h-11 rounded-full border grid place-items-center transition-colors ${buttonClassName}`}
        >
          <Icon name={SOCIAL_ICON[e.kind]} size={size} />
        </a>
      ))}
    </div>
  );
}
