import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function main() {
  const superAdminEmail = (process.env.SEED_SUPERADMIN_EMAIL || 'admin@kursim.local').toLowerCase();
  const superAdminPassword = process.env.SEED_SUPERADMIN_PASSWORD || 'Admin1234!';

  const SUPERADMIN_ID = '00000000-0000-4000-8000-000000000001';

  const superAdminHash = await hash(superAdminPassword, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.user.upsert({
    where: { id: SUPERADMIN_ID },
    update: { email: superAdminEmail },
    create: {
      id: SUPERADMIN_ID,
      email: superAdminEmail,
      passwordHash: superAdminHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      tenantId: null,
    },
  });

  console.log('\n=== Seed completed ===\n');
  console.log('Super Admin:');
  console.log(`  Email: ${superAdminEmail}`);
  console.log(`  Password: ${superAdminPassword}`);
  console.log('\nSign in at /superadmin/login and create your first school.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
