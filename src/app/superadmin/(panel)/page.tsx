import TenantsManager from '@/components/admin/TenantsManager';
import PageHeader from '@/components/ui/PageHeader';
import { he } from '@/lib/he';

export default function SuperAdminHome() {
  return (
    <div>
      <PageHeader
        kicker={he.superAdmin}
        title={he.tenants}
        subtitle="כל בתי הספר בפלטפורמה — יצירה, השעיה ומחיקה"
      />
      <TenantsManager />
    </div>
  );
}
