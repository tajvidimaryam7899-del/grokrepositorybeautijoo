/**
 * Beautijoo Development Seed
 * Credentials (DEV ONLY):
 *   Admin: 09120000000 / Admin@12345
 *   Zibagar: 09121111111 / Zibagar@123
 *   Customer: 09123333333 / Customer@123
 */
import { PrismaClient, DayOfWeek, ProfessionalStatus, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed starting...');
  const roles = [
    { name: 'customer', displayName: 'مشتری', isSystem: true },
    { name: 'professional', displayName: 'زیباگر', isSystem: true },
    { name: 'staff', displayName: 'کارمند', isSystem: true },
    { name: 'admin', displayName: 'مدیر', isSystem: true },
  ];
  for (const r of roles) {
    await prisma.role.upsert({ where: { name: r.name }, update: {}, create: r });
  }
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
  const admin = await prisma.user.upsert({
    where: { phone: '09120000000' },
    update: {},
    create: {
      phone: '09120000000',
      email: 'admin@beautijoo.local',
      passwordHash: await argon2.hash('Admin@12345'),
      status: UserStatus.active,
      phoneVerified: true,
      profile: { create: { displayName: 'مدیر سیستم' } },
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });
  // Categories, services, professional, location, hours, customer: see full seed in artifacts/seed.ts
  console.log('Minimal seed done. Use full artifacts/seed.ts for complete sample data.');
  console.log('Admin 09120000000 / Admin@12345');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
