import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { studentsImportSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { hashPassword } from '@/lib/auth/password';

export interface ImportRowResult {
  email: string;
  status: 'created' | 'exists' | 'error';
  /** Present only for created rows with a generated password — shown once. */
  password?: string;
}

/**
 * Bulk student import from CSV rows parsed client-side. Rows without a
 * password get a generated one, returned once in the response so the owner
 * can hand credentials out; every account starts with mustChangePassword.
 */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, studentsImportSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const results: ImportRowResult[] = [];
  const seen = new Set<string>();

  for (const row of parsed.data.rows) {
    const email = row.email.toLowerCase();
    if (seen.has(email)) continue; // duplicate line inside the file
    seen.add(email);

    try {
      const existing = await db.user.findFirst({ where: { email } });
      if (existing) {
        results.push({ email, status: 'exists' });
        continue;
      }
      const generated = row.password ? undefined : randomBytes(6).toString('base64url');
      const user = await db.user.create({
        data: {
          tenantId: auth.tenantId!,
          email,
          name: row.name || undefined,
          passwordHash: await hashPassword(row.password ?? generated!),
          role: 'STUDENT',
          status: 'ACTIVE',
          mustChangePassword: true,
        },
      });
      for (const courseId of row.courseIds) {
        const course = await db.course.findFirst({ where: { id: courseId } });
        if (course) {
          await db.enrollment.create({
            data: { tenantId: auth.tenantId!, studentId: user.id, courseId },
          });
        }
      }
      results.push({ email, status: 'created', password: generated });
    } catch {
      results.push({ email, status: 'error' });
    }
  }

  return NextResponse.json({ results });
}
