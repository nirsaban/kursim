import PageHeader from '@/components/ui/PageHeader';
import MentorCostsPanel from '@/components/admin/MentorCostsPanel';
import { he } from '@/lib/he';

export default function SuperAdminCostsPage() {
  return (
    <div>
      <PageHeader kicker={he.superAdmin} title={he.saCostsTitle} subtitle={he.saCostsSubtitle} />
      <MentorCostsPanel />
    </div>
  );
}
