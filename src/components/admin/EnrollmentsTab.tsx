'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { Select } from '@/components/ui/Field';
import { Card, CardHeader } from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';

interface Enrollment {
  id: string;
  student: { id: string; email: string };
}
interface Student {
  id: string;
  email: string;
  role: string;
}

export default function EnrollmentsTab({ courseId }: { courseId: string }) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const reload = useCallback(async () => {
    const [eRes, sRes] = await Promise.all([
      apiFetch(`/api/courses/${courseId}/enrollments`),
      apiFetch('/api/students'),
    ]);
    if (eRes.ok) setEnrollments((await eRes.json()).enrollments ?? []);
    if (sRes.ok) {
      const all = (await sRes.json()).students ?? [];
      setStudents(all.filter((s: Student) => s.role === 'STUDENT'));
    }
  }, [courseId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function enroll(studentId: string) {
    await apiFetch(`/api/courses/${courseId}/enrollments`, {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    });
    reload();
  }

  async function unenroll(studentId: string) {
    await apiFetch(`/api/courses/${courseId}/enrollments`, {
      method: 'DELETE',
      body: JSON.stringify({ studentId }),
    });
    reload();
  }

  const enrolledIds = new Set(enrollments.map((e) => e.student.id));
  const enrollable = students.filter((s) => !enrolledIds.has(s.id));

  return (
    <Card>
      <CardHeader
        title={`${he.enrollments} (${enrollments.length})`}
        actions={
          enrollable.length > 0 ? (
            <Select
              className="!w-64"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  enroll(e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="" disabled>
                {he.enrollStudent}
              </option>
              {enrollable.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.email}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      />
      {enrollments.length === 0 ? (
        <EmptyState icon="🧑‍🎓" title={he.noEnrollmentsYet} hint="תלמידים שיירשמו לקורס יופיעו כאן" />
      ) : (
        <ul className="divide-y divide-line/70">
          {enrollments.map((e) => (
            <li key={e.id} className="px-5 py-3 flex justify-between items-center text-sm">
              <span dir="ltr">{e.student.email}</span>
              <button
                onClick={() => unenroll(e.student.id)}
                className="text-xs font-medium text-muted hover:text-danger transition-colors"
              >
                {he.unenroll}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
