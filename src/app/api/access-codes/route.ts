import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { accessCodeCreateSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  return Array.from(
    { length: 8 },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
  ).join('');
}

/** Owner: list every access code with its course title. */
export async function GET() {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;

  const db = forTenant(auth.tenantId!);
  const [codes, courses] = await Promise.all([
    db.accessCode.findMany({ orderBy: { createdAt: 'desc' } }),
    db.course.findMany({ select: { id: true, title: true } }),
  ]);

  const titles = new Map(courses.map((c) => [c.id, c.title]));
  const withTitles = codes.map((c) => ({
    ...c,
    courseTitle: titles.get(c.courseId) ?? null,
  }));

  return NextResponse.json({ codes: withTitles, courses });
}

/** Owner: create a free-enrollment access code for a course. */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, accessCodeCreateSchema);
  if ('error' in parsed) return parsed.error;
  const { courseId, maxUses, expiresInDays } = parsed.data;

  const db = forTenant(auth.tenantId!);
  const course = await db.course.findFirst({
    where: { id: courseId },
    select: { id: true, title: true },
  });
  if (!course) return apiError(404, 'not_found');

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 864e5)
    : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const code = await db.accessCode.create({
        data: {
          tenantId: auth.tenantId!,
          courseId,
          code: generateCode(),
          maxUses,
          expiresAt,
        },
      });
      return NextResponse.json(
        { code: { ...code, courseTitle: course.title } },
        { status: 201 },
      );
    } catch (err) {
      // Unique collision on `code` → regenerate and retry.
      if (attempt === 4) throw err;
    }
  }

  return apiError(500, 'error');
}
