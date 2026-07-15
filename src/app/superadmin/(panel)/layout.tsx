import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { asSuperAdmin } from '@/lib/tenant/scoped-prisma';
import SessionWatcher from '@/components/SessionWatcher';
import Navbar from '@/components/Navbar';
import { he } from '@/lib/he';

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  if (!auth || auth.role !== 'SUPER_ADMIN') redirect('/superadmin/login');

  const user = await asSuperAdmin().user.findFirst({
    where: { id: auth.userId },
    select: { email: true },
  });

  return (
    <div className="min-h-screen">
      <SessionWatcher />
      <Navbar
        tone="ink"
        brandName="Kursim"
        brandHref="/superadmin"
        brandEmoji="🛠️"
        roleLabel={he.superAdmin}
        links={[
          { href: '/superadmin', label: he.tenants, exact: true },
          { href: '/superadmin/whatsapp', label: he.whatsappTitle },
        ]}
        userEmail={user?.email}
      />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
