import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseMarketing } from '@/lib/validation/marketing';
import { LANDING_THEMES } from '@/lib/landing-themes';
import { he } from '@/lib/he';

type Params = { params: Promise<{ slug: string; courseId: string }> };

/** Shown after a Grow checkout, once the owner points Grow's return URL here. */
export default async function ThankYouPage({ params }: Params) {
  const { slug, courseId } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant || tenant.status !== 'ACTIVE') notFound();

  const course = await forTenant(tenant.id).course.findFirst({
    where: { id: courseId },
    select: { title: true, marketing: true },
  });
  if (!course) notFound();

  const theme = LANDING_THEMES[parseMarketing(course.marketing).accent];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-paper">
      <div className="max-w-md w-full text-center bg-card border border-line rounded-xl2 shadow-lift p-8">
        <span className="text-5xl" aria-hidden>
          🎉
        </span>
        <h1 className="font-display text-2xl font-black mt-4">{he.thankYouTitle}</h1>
        <p className="text-muted mt-3 leading-relaxed">
          {he.thankYouBody.replace('{course}', course.title)}
        </p>
        <p className="text-xs text-muted mt-2">{he.thankYouHint}</p>
        <Link
          href={`/t/${slug}/login`}
          className="inline-flex items-center justify-center gap-2 font-bold text-[15px] rounded-full px-8 py-3.5 text-card mt-6 transition-transform hover:scale-[1.02] active:scale-[0.99]"
          style={{ background: theme.main }}
        >
          {he.thankYouLoginButton}
        </Link>
        <div className="mt-4">
          <Link
            href={`/t/${slug}/c/${courseId}`}
            className="text-sm text-muted hover:text-ink underline"
          >
            {he.thankYouBackToCourse}
          </Link>
        </div>
      </div>
    </div>
  );
}
