import { Suspense } from 'react';
import LoginForm from '@/components/LoginForm';
import AuthShell from '@/components/AuthShell';
import { he } from '@/lib/he';

export default function SuperAdminLoginPage() {
  return (
    <AuthShell
      title={he.superAdmin}
      subtitle="כניסה למנהלי הפלטפורמה בלבד"
      panelTitle="שליטה מלאה בפלטפורמה"
      panelText="ניהול בתי ספר, השעיות ומעקב שימוש — מכל מקום, בבטחה."
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
