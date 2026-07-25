import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import EnrollmentsTab from '@/components/admin/EnrollmentsTab';

export default async function CourseStudentsPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER') redirect(`/t/${slug}/admin/courses/${courseId}`);

  return <EnrollmentsTab courseId={courseId} />;
}
