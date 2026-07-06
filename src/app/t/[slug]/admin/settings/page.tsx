import SettingsForm from '@/components/admin/SettingsForm';
import PageHeader from '@/components/ui/PageHeader';
import { he } from '@/lib/he';

export default function AdminSettingsPage() {
  return (
    <div className="max-w-xl">
      <PageHeader kicker={he.admin} title={he.settings} />
      <SettingsForm />
    </div>
  );
}
