import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import CourseWizard from '@/components/admin/CourseWizard';

export default async function NewCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  return <CourseWizard tenantSlug={slug} />;
}
