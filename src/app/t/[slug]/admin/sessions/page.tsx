import LiveSessionsPanel from '@/components/admin/LiveSessionsPanel';
import PageHeader from '@/components/ui/PageHeader';
import { he } from '@/lib/he';

export default function AdminSessionsPage() {
  return (
    <div>
      <PageHeader
        kicker={he.admin}
        title={he.whoIsWatching}
        subtitle="כל המכשירים המחוברים כרגע — אפשר לנתק כל אחד מהם בלחיצה"
      />
      <LiveSessionsPanel />
    </div>
  );
}
