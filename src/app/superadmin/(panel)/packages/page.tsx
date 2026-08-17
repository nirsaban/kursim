import PageHeader from '@/components/ui/PageHeader';
import PlatformPackagesPanel from '@/components/admin/PlatformPackagesPanel';
import { he } from '@/lib/he';

export default function SuperAdminPackagesPage() {
  return (
    <div>
      <PageHeader kicker={he.superAdmin} title={he.saPackagesTitle} subtitle={he.saPackagesSubtitle} />
      <PlatformPackagesPanel />
    </div>
  );
}
