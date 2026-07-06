import StudentsManager from '@/components/admin/StudentsManager';
import PageHeader from '@/components/ui/PageHeader';
import { he } from '@/lib/he';

export default function AdminStudentsPage() {
  return (
    <div>
      <PageHeader
        kicker={he.admin}
        title={he.students}
        subtitle="ניהול חשבונות, הזמנות וחיבורים של התלמידים"
      />
      <StudentsManager />
    </div>
  );
}
