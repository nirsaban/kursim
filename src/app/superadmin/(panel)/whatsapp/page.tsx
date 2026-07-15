import PageHeader from '@/components/ui/PageHeader';
import WhatsappConnect from '@/components/superadmin/WhatsappConnect';
import { he } from '@/lib/he';

export default function SuperAdminWhatsappPage() {
  return (
    <div className="max-w-lg">
      <PageHeader kicker={he.superAdmin} title={he.whatsappTitle} subtitle={he.whatsappSubtitle} />
      <WhatsappConnect />
    </div>
  );
}
