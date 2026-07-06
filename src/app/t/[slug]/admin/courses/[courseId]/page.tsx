import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import CourseEditor from '@/components/admin/CourseEditor';
import { he } from '@/lib/he';

export default async function AdminCourseEditorPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  const course = await forTenant(auth.tenantId!).course.findFirst({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) notFound();

  return (
    <div>
      <Link
        href={`/t/${slug}/admin/courses`}
        className="text-sm text-brand-700 hover:underline font-medium"
      >
        → {he.courses}
      </Link>
      <CourseEditor courseId={courseId} tenantSlug={slug} isOwner={auth.role === 'OWNER'} />
    </div>
  );
}
