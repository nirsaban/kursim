import ChangePasswordForm from '@/components/ChangePasswordForm';
import { he } from '@/lib/he';

export default async function ChangePasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ forced?: string }>;
}) {
  const { slug } = await params;
  const { forced } = await searchParams;
  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">{he.changePassword}</h1>
      <ChangePasswordForm redirectTo={`/t/${slug}`} forced={forced === '1'} />
    </div>
  );
}
