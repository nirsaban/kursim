import type { TenantClient } from '@/lib/tenant/scoped-prisma';
import { sendMail } from '@/lib/email';

/**
 * Email automations ("learning reminders"): owner-defined trigger + template.
 *
 * WELCOME fires inline the first time a student is enrolled in anything;
 * INACTIVITY fires from the periodic sweep (/api/cron/automations). Both are
 * best-effort — a mail outage must never fail the enrollment that fired it.
 */

/** {{name}} / {{org_name}} / {{course_title}} / {{days}} substitution. */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
}

/**
 * Fire the tenant's active WELCOME automations for a just-enrolled student.
 * The AutomationSend row makes this once-per-student — a second course
 * enrollment won't send a second welcome.
 */
export async function fireWelcomeAutomations(
  db: TenantClient,
  tenantId: string,
  studentId: string,
  courseId?: string,
): Promise<void> {
  try {
    const automations = await db.emailAutomation.findMany({
      where: { trigger: 'WELCOME', active: true },
    });
    if (automations.length === 0) return;

    const [student, tenant, course] = await Promise.all([
      db.user.findFirst({ where: { id: studentId }, select: { email: true, name: true } }),
      db.tenant.findFirst({ where: { id: tenantId }, select: { name: true } }),
      courseId
        ? db.course.findFirst({ where: { id: courseId }, select: { title: true } })
        : Promise.resolve(null),
    ]);
    if (!student) return;

    const vars = {
      name: student.name || student.email,
      org_name: tenant?.name ?? '',
      course_title: course?.title ?? '',
    };

    for (const a of automations) {
      const already = await db.automationSend.findFirst({
        where: { automationId: a.id, studentId },
      });
      if (already) continue;
      await db.automationSend.create({ data: { tenantId, automationId: a.id, studentId } });
      const sent = await sendMail({
        to: student.email,
        subject: renderTemplate(a.subject, vars),
        text: renderTemplate(a.body, vars),
      });
      if (sent.ok) {
        await db.emailAutomation.updateMany({
          where: { id: a.id },
          data: { sentCount: { increment: 1 } },
        });
      }
    }
  } catch {
    // Best-effort by contract: enrollment must succeed even if this path dies.
  }
}

/**
 * One tenant's inactivity sweep. A student is "inactive" when their newest
 * learning-activity day (or account creation, if they never learned) is at
 * least `days` ago. Each quiet spell gets at most one nudge per automation:
 * a repeat send happens only after the student was active again since the
 * last nudge. Returns how many emails went out.
 */
export async function runInactivitySweep(
  db: TenantClient,
  tenantId: string,
  now = new Date(),
): Promise<number> {
  const automations = await db.emailAutomation.findMany({
    where: { trigger: 'INACTIVITY', active: true },
  });
  if (automations.length === 0) return 0;

  const [students, tenant] = await Promise.all([
    db.user.findMany({
      where: { role: 'STUDENT', status: 'ACTIVE' },
      select: { id: true, email: true, name: true, createdAt: true },
    }),
    db.tenant.findFirst({ where: { id: tenantId }, select: { name: true } }),
  ]);
  if (students.length === 0) return 0;

  // Newest activity day per student, one query for the whole tenant.
  const lastByStudent = new Map<string, Date>();
  const activity = await db.learningActivity.groupBy({
    by: ['studentId'],
    _max: { date: true },
  });
  for (const a of activity) {
    if (a._max.date) lastByStudent.set(a.studentId, a._max.date);
  }

  let sent = 0;
  for (const a of automations) {
    const cutoff = new Date(now.getTime() - a.days * 86_400_000);
    for (const s of students) {
      const lastActive = lastByStudent.get(s.id) ?? s.createdAt;
      if (lastActive > cutoff) continue;

      const prev = await db.automationSend.findFirst({
        where: { automationId: a.id, studentId: s.id },
      });
      // Already nudged during this quiet spell — wait for them to come back.
      if (prev && prev.sentAt >= lastActive) continue;

      const vars = {
        name: s.name || s.email,
        org_name: tenant?.name ?? '',
        days: String(a.days),
      };
      const result = await sendMail({
        to: s.email,
        subject: renderTemplate(a.subject, vars),
        text: renderTemplate(a.body, vars),
      });
      if (!result.ok) continue;

      if (prev) {
        await db.automationSend.updateMany({
          where: { id: prev.id },
          data: { sentAt: now },
        });
      } else {
        await db.automationSend.create({
          data: { tenantId, automationId: a.id, studentId: s.id, sentAt: now },
        });
      }
      await db.emailAutomation.updateMany({
        where: { id: a.id },
        data: { sentCount: { increment: 1 } },
      });
      sent += 1;
    }
  }
  return sent;
}
