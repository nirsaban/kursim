import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import type { TenantHomepage } from '@/lib/validation/homepage';
import { he } from '@/lib/he';

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long' });

/** Owner announcements ("notice board") on the student home page. */
export default function AnnouncementsCard({
  announcements,
}: {
  announcements: TenantHomepage['announcements'];
}) {
  if (announcements.length === 0) return null;
  return (
    <Card>
      <CardHeader title={`📌 ${he.announcementsTitle}`} />
      <CardBody className="p-0">
        <ul className="divide-y divide-line/70">
          {announcements.map((a, i) => (
            <li key={i} className="px-5 py-4">
              <div className="flex items-baseline gap-3">
                <p className="font-semibold">{a.title}</p>
                {a.date && (
                  <span className="ms-auto shrink-0 text-xs text-muted tabular-nums">
                    {dateFmt.format(new Date(`${a.date}T00:00:00`))}
                  </span>
                )}
              </div>
              {a.body && (
                <p className="text-sm text-muted mt-1 leading-relaxed whitespace-pre-line">
                  {a.body}
                </p>
              )}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
