import ChangePasswordForm from '@/components/ChangePasswordForm';
import { he } from '@/lib/he';

export default async function ChangePasswordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">{he.changePassword}</h1>
      <ChangePasswordForm redirectTo={`/t/${slug}`} />
    </div>
  );
}
