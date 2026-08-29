import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { he } from '@/lib/he';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reason?: string }>;
};

/**
 * Where the Hyp return handler sends a buyer whose payment did not settle —
 * a declined card, a failed signature check, or an amount that didn't match
 * the order. The `reason` is for us, not the buyer: it's rendered small and
 * unexplained, so a support call can quote it without alarming anyone.
 */
export default async function PayFailedPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { reason } = await searchParams;
  const tenant = await getTenantBySlug(slug);
  if (!tenant || tenant.status !== 'ACTIVE') notFound();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-paper">
      <div className="max-w-md w-full text-center bg-card border border-line rounded-xl2 shadow-lift p-8">
        <span className="text-5xl" aria-hidden>
          😕
        </span>
        <h1 className="font-display text-2xl font-bold mt-4">{he.payFailedTitle}</h1>
        <p className="text-muted mt-3 leading-relaxed">{he.payFailedBody}</p>
        <p className="text-xs text-muted mt-3">{he.payFailedSupport}</p>
        <Link
          href={`/t/${slug}`}
          className="inline-flex items-center justify-center gap-2 font-bold text-[15px] rounded-full px-8 py-3.5 mt-6 border-[1.5px] border-ink text-ink hover:bg-brand-50 transition-colors"
        >
          {he.payFailedBackHome}
        </Link>
        {reason && (
          <p dir="ltr" className="text-[10px] text-muted/60 mt-5 font-mono">
            {reason}
          </p>
        )}
      </div>
    </div>
  );
}
