import { Suspense } from 'react';
import LoginForm from '@/components/LoginForm';
import AuthShell from '@/components/AuthShell';
import { he } from '@/lib/he';

export default function SuperAdminLoginPage() {
  return (
    <AuthShell
      title={he.superAdmin}
      subtitle={he.superAdminLoginSubtitle}
      panelTitle={he.superAdminPanelTitle}
      panelText={he.superAdminPanelText}
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
