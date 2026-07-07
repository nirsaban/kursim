import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';

type Params = { params: Promise<{ courseId: string }> };

/** Poll the generation status + published URLs for a course's AI media. */
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;

  const db = forTenant(auth.tenantId!);
  const media = await db.courseMedia.findFirst({ where: { courseId } });
  if (!media) return NextResponse.json({ status: 'idle' });

  return NextResponse.json({
    status: media.status,
    framesBaseUrl: media.framesBaseUrl,
    frameCount: media.frameCount,
    posterUrl: media.posterUrl,
    videoUrl: media.videoUrl,
    stills: media.stills ?? [],
    error: media.error,
  });
}
