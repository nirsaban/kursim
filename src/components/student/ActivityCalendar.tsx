import { prevDayKey } from '@/lib/achievements';

const weekdayFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'narrow', timeZone: 'UTC' });
const dayFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', timeZone: 'UTC' });

// 2023-01-01 was a Sunday; used only to render the א…ש column headers.
const WEEKDAY_HEADERS = Array.from({ length: 7 }, (_, i) =>
  weekdayFmt.format(new Date(Date.UTC(2023, 0, 1 + i))),
);

function utcDateOf(key: string) {
  return new Date(`${key}T00:00:00Z`);
}

/**
 * Last-4-weeks activity grid (rows = weeks, columns = Sunday→Saturday),
 * ending on today's row. Active days fill with the school accent.
 */
export default function ActivityCalendar({
  activeDays,
  todayKey,
  color,
}: {
  activeDays: string[];
  todayKey: string;
  color: string;
}) {
  const active = new Set(activeDays);
  const todayWeekday = utcDateOf(todayKey).getUTCDay(); // 0 = Sunday

  // 3 full weeks + the current partial week, oldest first.
  const keys: string[] = [todayKey];
  for (let i = 0; i < 21 + todayWeekday; i++) keys.unshift(prevDayKey(keys[0]));
  const cells: (string | null)[] = [...keys, ...Array<null>(6 - todayWeekday).fill(null)];

  return (
    <div dir="rtl" className="inline-block">
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAY_HEADERS.map((w, i) => (
          <span key={`h${i}`} className="text-[10px] font-semibold text-muted">
            {w}
          </span>
        ))}
        {cells.map((key, i) =>
          key === null ? (
            <span key={`x${i}`} className="w-7 h-7" />
          ) : (
            <span
              key={key}
              title={dayFmt.format(utcDateOf(key))}
              className="w-7 h-7 rounded-lg border transition-colors"
              style={{
                background: active.has(key) ? color : '#F4F2EC',
                borderColor: key === todayKey ? color : 'transparent',
                borderWidth: key === todayKey ? 2 : 1,
              }}
            />
          ),
        )}
      </div>
    </div>
  );
}
