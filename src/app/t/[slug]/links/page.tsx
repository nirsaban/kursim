import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { getAuth } from '@/lib/auth/guards';
import { parseLinktree, parseSocials, type LinktreeButtonStyle } from '@/lib/validation/links';
import { parseBranding } from '@/lib/validation/branding';
import { LANDING_THEMES } from '@/lib/landing-themes';
import { trackLinktreeView } from '@/lib/analytics/page-views';
import SocialLinks from '@/components/landing/SocialLinks';
import { he } from '@/lib/he';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return {};
  const lt = parseLinktree(tenant.linktree);
  const title = lt.headline || tenant.name;
  const description = lt.bio || undefined;
  return {
    title,
    description,
    openGraph: {
      type: 'website',
      title,
      description,
      siteName: tenant.name,
      locale: 'he_IL',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

const BUTTON_STYLES: Record<LinktreeButtonStyle, string> = {
  solid: 'bg-white text-ink shadow-lg',
  outline: 'border-2 border-white/70 text-white hover:bg-white/10',
  soft: 'bg-white/15 text-white backdrop-blur-sm hover:bg-white/25',
};

/** The school's public link-in-bio page. 404 unless published (staff preview). */
export default async function LinktreePage({ params }: Params) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant || tenant.status !== 'ACTIVE') notFound();

  const lt = parseLinktree(tenant.linktree);
  let previewMode = false;
  if (!lt.published) {
    const auth = await getAuth();
    const isStaff =
      auth && auth.tenantId === tenant.id && (auth.role === 'OWNER' || auth.role === 'INSTRUCTOR');
    if (!isStaff) notFound();
    previewMode = true;
  }

  // Gated on published so a staff preview never inflates the counter.
  if (!previewMode) {
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const ua = h.get('user-agent') ?? '';
    await trackLinktreeView(tenant.id, ip, ua).catch(() => {});
  }

  const socials = parseSocials(tenant.socials);
  const branding = parseBranding(tenant.branding);
  const theme = LANDING_THEMES[lt.accent];
  const title = lt.headline || tenant.name;

  return (
    <main
      className="min-h-screen flex flex-col items-center px-4 py-10 sm:py-16"
      style={{ background: theme.deep }}
    >
      {previewMode && (
        <p className="w-full max-w-md text-center text-sm font-semibold text-white bg-black/30 rounded-xl px-4 py-2.5 mb-6">
          {he.linktreePreviewBanner}
        </p>
      )}

      <div className="w-full max-w-md flex flex-col items-center text-center flex-1">
        <span className="w-24 h-24 rounded-full bg-white shadow-xl grid place-items-center overflow-hidden mb-5">
          {branding.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo} alt={tenant.name} className="max-w-[80%] max-h-[80%] object-contain" />
          ) : (
            <span className="font-display font-bold text-3xl" style={{ color: theme.deep }}>
              {tenant.name.charAt(0)}
            </span>
          )}
        </span>

        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight">{title}</h1>
        {lt.bio && <p className="text-white/75 mt-2.5 leading-relaxed max-w-sm">{lt.bio}</p>}

        <div className="w-full space-y-3.5 mt-8">
          {lt.links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center gap-2.5 w-full min-h-[56px] rounded-2xl px-5 font-bold text-[15px] transition-colors duration-150 ${BUTTON_STYLES[lt.buttonStyle]}`}
            >
              {link.emoji && <span aria-hidden>{link.emoji}</span>}
              <span className="truncate">{link.label}</span>
            </a>
          ))}
        </div>

        <SocialLinks
          socials={socials}
          className="mt-9"
          buttonClassName="border-white/30 hover:border-white/70 text-white/80 hover:text-white"
        />
      </div>

      <footer className="mt-12">
        <Link href="/" className="text-white/50 hover:text-white/80 text-xs font-medium transition-colors">
          {he.landingBuiltWith} · {he.appName}
        </Link>
      </footer>
    </main>
  );
}
