import AuthShell from '@/components/AuthShell';
import SignupForm from '@/components/SignupForm';
import { he } from '@/lib/he';

export const metadata = { title: `${he.signupTitle} · Kursim` };

export default function SignupPage() {
  return (
    <AuthShell
      title={he.signupTitle}
      subtitle={he.signupSubtitle}
      panelTitle={he.signupPanelTitle}
      panelText={he.signupPanelText}
    >
      <SignupForm />
    </AuthShell>
  );
}
