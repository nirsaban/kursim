import { getRedis } from '@/lib/redis';
import { prisma } from '@/lib/tenant/prisma';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { normalizePlan, planHasMentor } from '@/lib/billing';
import { he } from '@/lib/he';

/**
 * The AI mentor ("מנטור") — a course-grounded assistant that answers students
 * on the school's own WhatsApp number. GROWTH package and up.
 *
 * Conversation shape (per student, per school):
 *   recognize phone → list the student's mentor-enabled courses → they pick a
 *   number → a session binds to that course → every message is answered by
 *   Gemini FROM THE COURSE CONTENT ONLY. "תפריט" starts a new session.
 *
 * Silence is a feature: the school's number is often the owner's personal one,
 * so anyone who is not a recognized, enrolled student gets no reply at all.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const SESSION_TTL_SEC = 12 * 3600;
const BRAIN_TTL_SEC = 15 * 60;
const DAILY_CAP = 30;
const HISTORY_TURNS = 8;

const sessKey = (tenantId: string, userId: string) => `mentor:sess:${tenantId}:${userId}`;
const brainKey = (courseId: string) => `mentor:brain:${courseId}`;
const capKey = (userId: string) =>
  `mentor:cap:${userId}:${new Date().toISOString().slice(0, 10)}`;

interface MentorSession {
  courseId: string | null;
  /** Course ids offered in the last menu, in display order. */
  offered: string[];
  history: Array<{ q: string; a: string }>;
}

async function loadSession(tenantId: string, userId: string): Promise<MentorSession | null> {
  const raw = await getRedis().get(sessKey(tenantId, userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MentorSession;
  } catch {
    return null;
  }
}

async function saveSession(tenantId: string, userId: string, s: MentorSession): Promise<void> {
  await getRedis().set(sessKey(tenantId, userId), JSON.stringify(s), 'EX', SESSION_TTL_SEC);
}

// ── Course brain ─────────────────────────────────────────────────────────────

/**
 * Everything the mentor is allowed to know about one course, as plain text
 * with lesson anchors. Sources: description, lesson notes and transcripts.
 * Cached briefly in Redis so a chatty student doesn't recompile per message.
 */
export async function compileCourseBrain(tenantId: string, courseId: string): Promise<string> {
  const cached = await getRedis().get(brainKey(courseId));
  if (cached) return cached;

  const course = await forTenant(tenantId).course.findFirst({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { sortOrder: 'asc' },
        include: {
          lessons: {
            orderBy: { sortOrder: 'asc' },
            select: { title: true, notes: true, transcript: true },
          },
        },
      },
    },
  });
  if (!course) return '';

  const parts: string[] = [`# קורס: ${course.title}`];
  if (course.description) parts.push(course.description);
  for (const mod of course.modules) {
    parts.push(`\n## פרק: ${mod.title}`);
    for (const lesson of mod.lessons) {
      parts.push(`\n### שיעור: ${lesson.title}`);
      if (lesson.notes) parts.push(lesson.notes);
      if (lesson.transcript) parts.push(`תמליל:\n${lesson.transcript}`);
    }
  }
  // Keep the prompt bounded even for transcript-heavy courses.
  const brain = parts.join('\n').slice(0, 400_000);
  await getRedis().set(brainKey(courseId), brain, 'EX', BRAIN_TTL_SEC);
  return brain;
}

// ── Gemini ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `אתה "המנטור" — עוזר לימודי של קורס דיגיטלי, עונה לתלמידים בוואטסאפ.
כללים מחייבים:
- ענה בעברית, קצר וידידותי (עד ~6 שורות; וואטסאפ, לא מאמר).
- ענה אך ורק מתוך תוכן הקורס שמצורף למטה. אל תמציא מידע שלא נמצא בו.
- כשהתשובה נמצאת בשיעור מסוים, ציין את שם השיעור ("מוסבר בשיעור: ...").
- אם התשובה לא נמצאת בתוכן הקורס — אמור זאת בכנות והפנה את התלמיד לשאול את המרצה דרך עמוד השיעור.
- אל תדון בנושאים שאינם הקורס (פוליטיקה, בקשות אישיות וכו') — החזר בעדינות לנושא הקורס.`;

async function askGemini(brain: string, history: MentorSession['history'], question: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model =
    process.env.GEMINI_MENTOR_MODEL || process.env.GEMINI_TEXT_MODEL || 'gemini-3.1-pro-preview';

  const contents = [
    ...history.flatMap((t) => [
      { role: 'user', parts: [{ text: t.q }] },
      { role: 'model', parts: [{ text: t.a }] },
    ]),
    { role: 'user', parts: [{ text: question }] },
  ];

  try {
    const res = await fetch(`${API_BASE}/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `${SYSTEM_PROMPT}\n\n--- תוכן הקורס ---\n${brain}` }],
        },
        contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return text.trim() || null;
  } catch {
    return null;
  }
}

// ── Conversation ─────────────────────────────────────────────────────────────

function courseMenu(name: string, courses: Array<{ title: string }>): string {
  const lines = courses.map((c, i) => `${i + 1}. ${c.title}`);
  return (
    he.mentorGreeting.replace('{name}', name || '') +
    '\n\n' +
    lines.join('\n') +
    '\n\n' +
    he.mentorPickHint
  );
}

/**
 * One incoming WhatsApp message to a SCHOOL's number. Returns the mentor's
 * reply, or null for "stay silent" (unrecognized sender, plan too low, no
 * mentor-enabled courses — never hijack the owner's personal conversations).
 */
export async function handleMentorMessage(
  tenantId: string,
  phone: string,
  text: string,
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Feature gate: GROWTH and up.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, status: true },
  });
  if (!tenant || tenant.status !== 'ACTIVE' || !planHasMentor(normalizePlan(tenant.plan))) {
    return null;
  }

  // Recognize the student by phone (suffix match meets both 05… and 972… forms).
  const db = forTenant(tenantId);
  const student = await db.user.findFirst({
    where: { role: 'STUDENT', status: 'ACTIVE', phone: { endsWith: phone.slice(-9) } },
    select: { id: true, name: true, email: true },
  });
  if (!student) return null;

  // Their mentor-enabled published courses.
  const enrollments = await db.enrollment.findMany({
    where: { studentId: student.id },
    select: { course: { select: { id: true, title: true, status: true, mentorEnabled: true } } },
  });
  const courses = enrollments
    .map((e) => e.course)
    .filter((c) => c.status === 'PUBLISHED' && c.mentorEnabled);
  if (courses.length === 0) return null;

  const firstName = (student.name || student.email).split(/[@ ]/)[0];
  let session = await loadSession(tenantId, student.id);

  // "תפריט" (or similar) always starts a fresh session with the course list.
  if (/תפריט|החלפת קורס|קורס אחר|התחלה מחדש/.test(trimmed)) session = null;

  // New session: greet and list the courses (auto-bind when there is only one).
  if (!session) {
    if (courses.length === 1) {
      session = { courseId: courses[0].id, offered: [courses[0].id], history: [] };
      await saveSession(tenantId, student.id, session);
      return he.mentorSingleCourse
        .replace('{name}', firstName)
        .replace('{course}', courses[0].title);
    }
    session = { courseId: null, offered: courses.map((c) => c.id), history: [] };
    await saveSession(tenantId, student.id, session);
    return courseMenu(firstName, courses);
  }

  // Menu state: expect a course number.
  if (!session.courseId) {
    const pick = Number(trimmed.replace(/[^\d]/g, ''));
    const chosenId = pick >= 1 && pick <= session.offered.length ? session.offered[pick - 1] : null;
    const chosen = chosenId ? courses.find((c) => c.id === chosenId) : null;
    if (!chosen) return courseMenu(firstName, courses);
    session = { courseId: chosen.id, offered: session.offered, history: [] };
    await saveSession(tenantId, student.id, session);
    return he.mentorCourseBound.replace('{course}', chosen.title);
  }

  // Bound session: answer from the course, within the daily cap.
  const active = session;
  const r = getRedis();
  const used = await r.incr(capKey(student.id));
  if (used === 1) await r.expire(capKey(student.id), 26 * 3600);
  if (used > DAILY_CAP) return he.mentorCapReached;

  const course = courses.find((c) => c.id === active.courseId);
  if (!course) {
    // Enrollment or toggle changed under the session — back to the menu.
    await saveSession(tenantId, student.id, {
      courseId: null,
      offered: courses.map((c) => c.id),
      history: [],
    });
    return courseMenu(firstName, courses);
  }

  const brain = await compileCourseBrain(tenantId, course.id);
  const answer = brain ? await askGemini(brain, active.history, trimmed) : null;
  if (!answer) return he.mentorUnavailable;

  active.history = [...active.history, { q: trimmed, a: answer }].slice(-HISTORY_TURNS);
  await saveSession(tenantId, student.id, active);
  return `${answer}\n\n${he.mentorFooter}`;
}
