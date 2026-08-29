import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import {
  assertTestDatabase,
  cleanupUserData,
  createPrisma,
  migrateTestDb,
  seedRoles,
} from '../helpers/db';
import { register, uniquePhone, me } from '../helpers/auth.helper';
import { PrismaClient } from '@prisma/client';

describe('Auth Registration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const password = 'SecurePass1';

  beforeAll(async () => {
    assertTestDatabase();
    migrateTestDb();
    seedRoles();
    prisma = createPrisma();
    app = await createTestApp();
  });

  afterEach(async () => {
    await cleanupUserData(prisma);
  });

  afterAll(async () => {
    await cleanupUserData(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  describe('Customer registration', () => {
    it('registers without role → customer only, no professional, issues tokens', async () => {
      const phone = uniquePhone();
      const res = await register(app, { phone, password, displayName: 'مشتری تست' });

      expect(res.status).toBe(201);
      expect(res.body.user.phone).toBe(phone);
      expect(res.body.user.roles).toEqual(['customer']);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      const dbUser = await prisma.user.findUnique({
        where: { phone },
        include: { profile: true, professional: true, userRoles: { include: { role: true } } },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.profile?.displayName).toBe('مشتری تست');
      expect(dbUser!.professional).toBeNull();
      expect(dbUser!.userRoles.map((r) => r.role.name).sort()).toEqual(['customer']);
    });

    it('registers with role=customer → same behavior', async () => {
      const phone = uniquePhone();
      const res = await register(app, {
        phone,
        password,
        displayName: 'Customer Explicit',
        role: 'customer',
      });

      expect(res.status).toBe(201);
      expect(res.body.user.roles).toEqual(['customer']);
      expect(res.body.accessToken).toBeDefined();
      expect(await prisma.professional.findFirst({ where: { user: { phone } } })).toBeNull();
    });

    it('rejects duplicate phone with 409', async () => {
      const phone = uniquePhone();
      expect((await register(app, { phone, password })).status).toBe(201);
      expect((await register(app, { phone, password })).status).toBe(409);
    });
  });

  describe('Professional registration', () => {
    it('registers with role=professional → roles, pending_review, slug, title, tokens', async () => {
      const phone = uniquePhone();
      const res = await register(app, {
        phone,
        password,
        displayName: 'زیباگر تست',
        role: 'professional',
      });

      expect(res.status).toBe(201);
      expect(res.body.user.roles.sort()).toEqual(['customer', 'professional']);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      const dbUser = await prisma.user.findUnique({
        where: { phone },
        include: {
          profile: true,
          professional: true,
          userRoles: { include: { role: true } },
        },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.professional).not.toBeNull();
      expect(dbUser!.professional!.status).toBe('pending_review');
      expect(dbUser!.professional!.title).toBe('زیباگر تست');
      expect(dbUser!.professional!.slug).toMatch(/^z-/);
      expect(dbUser!.userRoles.map((r) => r.role.name).sort()).toEqual([
        'customer',
        'professional',
      ]);
    });

    it('GET /auth/me returns professional for new زیباگر', async () => {
      const phone = uniquePhone();
      const reg = await register(app, {
        phone,
        password,
        displayName: 'Me Pro',
        role: 'professional',
      });
      expect(reg.status).toBe(201);

      const meRes = await me(app, reg.body.accessToken);
      expect(meRes.status).toBe(200);
      expect(meRes.body.roles.sort()).toEqual(['customer', 'professional']);
      expect(meRes.body.professional).not.toBeNull();
      expect(meRes.body.professional.status).toBe('pending_review');
      expect(meRes.body.professional.slug).toBeDefined();
      expect(meRes.body.professional.title).toBe('Me Pro');
    });

    it('pending_review professional can PATCH /professionals/me', async () => {
      const phone = uniquePhone();
      const reg = await register(app, {
        phone,
        password,
        displayName: 'Panel Pro',
        role: 'professional',
      });
      expect(reg.status).toBe(201);

      const patch = await request(app.getHttpServer())
        .patch('/api/v1/professionals/me')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ title: 'عنوان جدید', bio: 'بیو تست' });

      expect(patch.status).toBe(200);
      expect(patch.body.title).toBe('عنوان جدید');
    });
  });

  describe('Role security', () => {
    it.each(['admin', 'staff', 'superuser', 'random_role_xyz'])(
      'rejects role=%s',
      async (role) => {
        const res = await register(app, {
          phone: uniquePhone(),
          password,
          role,
        });
        expect(res.status).toBe(400);
        expect(res.body.accessToken).toBeUndefined();
      },
    );
  });
});
