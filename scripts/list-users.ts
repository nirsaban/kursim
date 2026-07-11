/**
 * DEV-ONLY credential dump.
 *
 * Passwords are stored as one-way argon2 hashes and can never be read back.
 * So this script RESETS every user to a single known dev password, then prints
 * email / role / tenant / password / login link for each — giving you working
 * test credentials for the whole database.
 *
 *   npm run users            # reset all + print table
 *   npm run users -- --list  # print table WITHOUT resetting (password shown as "?")
 *
 * Override the reset password with DEV_PASSWORD=... ; base URL with APP_URL=...
 *
 * Refuses to run against a non-local database unless FORCE=1 is set.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';

// Use the owner/migrate connection: the app role has RLS enforced and can't see
// the superadmin (tenantId null) or cross-tenant rows. Fall back to the local
// dev owner DB (matches scripts/dev-full.sh) so `npm run users` works with no setup.
const DB_URL =
  process.env.ADMIN_DATABASE_URL ||
  process.env.MIGRATE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:15432/kursim';

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

const DEV_PASSWORD = process.env.DEV_PASSWORD || 'Dev1234!';
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const LIST_ONLY = process.argv.includes('--list');

function loginLink(role: string, slug: string | null): string {
  if (role === 'SUPER_ADMIN') return `${APP_URL}/superadmin/login`;
  return slug ? `${APP_URL}/t/${slug}/login` : `${APP_URL}/login`;
}

function assertLocal() {
  const url = DB_URL;
  const local = /localhost|127\.0\.0\.1|@postgres[:/]/.test(url);
  if (!local && process.env.FORCE !== '1') {
    console.error(
      `\nRefusing to run: DATABASE_URL does not look local.\n` +
        `  ${url.replace(/:[^:@/]+@/, ':****@')}\n` +
        `Set FORCE=1 to override (this will overwrite real passwords!).\n`,
    );
    process.exit(1);
  }
}

async function main() {
  if (!LIST_ONLY) assertLocal();

  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
    include: { tenant: { select: { slug: true, name: true } } },
  });

  if (users.length === 0) {
    console.log('\nNo users found. Run `npm run db:seed` first.\n');
    return;
  }

  if (!LIST_ONLY) {
    const passwordHash = await hashPassword(DEV_PASSWORD);
    await prisma.user.updateMany({ data: { passwordHash, mustChangePassword: false } });
    console.log(`\n✔ Reset ${users.length} user(s) to password: ${DEV_PASSWORD}\n`);
  } else {
    console.log(`\n(listing only — passwords NOT reset)\n`);
  }

  const rows = users.map((u) => ({
    email: u.email,
    role: u.role,
    tenant: u.tenant?.slug ?? '—',
    password: LIST_ONLY ? '?' : DEV_PASSWORD,
    link: loginLink(u.role, u.tenant?.slug ?? null),
  }));

  const cols: { key: keyof (typeof rows)[number]; label: string }[] = [
    { key: 'email', label: 'EMAIL' },
    { key: 'role', label: 'ROLE' },
    { key: 'tenant', label: 'TENANT' },
    { key: 'password', label: 'PASSWORD' },
    { key: 'link', label: 'LOGIN LINK' },
  ];
  const width = (k: keyof (typeof rows)[number]) =>
    Math.max(cols.find((c) => c.key === k)!.label.length, ...rows.map((r) => String(r[k]).length));
  const widths = Object.fromEntries(cols.map((c) => [c.key, width(c.key)]));
  const line = (vals: string[]) => vals.map((v, i) => v.padEnd(Object.values(widths)[i])).join('  ');

  console.log(line(cols.map((c) => c.label)));
  console.log(line(cols.map((c) => '-'.repeat(Object.values(widths)[cols.indexOf(c)]))));
  for (const r of rows) console.log(line(cols.map((c) => String(r[c.key]))));
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
