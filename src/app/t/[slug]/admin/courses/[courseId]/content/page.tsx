import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import ContentSectionClient from '@/components/admin/course/ContentSectionClient';

export default async function CourseContentPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  return <ContentSectionClient courseId={courseId} />;
}
