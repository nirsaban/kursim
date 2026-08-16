import PageHeader from '@/components/ui/PageHeader';
import PlatformLeadsPanel from '@/components/admin/PlatformLeadsPanel';
import { he } from '@/lib/he';

export default function SuperAdminLeadsPage() {
  return (
    <div>
      <PageHeader kicker={he.superAdmin} title={he.saLeadsTitle} subtitle={he.saLeadsSubtitle} />
      <PlatformLeadsPanel />
    </div>
  );
}
