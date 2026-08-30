/**
 * Production-safe catalog seed (categories + services).
 * Idempotent upserts — safe to run on every deploy/start.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CATALOG = [
  {
    name: 'مو',
    slug: 'hair',
    sortOrder: 1,
    children: [
      {
        name: 'کوتاهی و اصلاح',
        slug: 'hair-cut',
        sortOrder: 1,
        services: [
          { name: 'کوتاهی مو زنانه', slug: 'haircut-women' },
          { name: 'کوتاهی مو مردانه', slug: 'haircut-men' },
          { name: 'اصلاح ابرو', slug: 'brow-shape' },
        ],
      },
      {
        name: 'رنگ و هایلایت',
        slug: 'hair-color',
        sortOrder: 2,
        services: [
          { name: 'رنگ مو', slug: 'hair-color-full' },
          { name: 'هایلایت', slug: 'hair-highlight' },
          { name: 'بالیاژ', slug: 'hair-balayage' },
        ],
      },
      {
        name: 'مراقبت مو',
        slug: 'hair-care',
        sortOrder: 3,
        services: [
          { name: 'کراتین', slug: 'keratin' },
          { name: 'بوتاکس مو', slug: 'hair-botox' },
          { name: 'ماساژ و ماسک مو', slug: 'hair-mask' },
        ],
      },
    ],
    services: [],
  },
  {
    name: 'ناخن',
    slug: 'nails',
    sortOrder: 2,
    children: [
      {
        name: 'مانیکور',
        slug: 'manicure-cat',
        sortOrder: 1,
        services: [
          { name: 'مانیکور ساده', slug: 'manicure' },
          { name: 'کاشت ناخن', slug: 'nail-extension' },
          { name: 'ژل پولیش', slug: 'gel-polish' },
        ],
      },
      {
        name: 'پدیکور',
        slug: 'pedicure-cat',
        sortOrder: 2,
        services: [
          { name: 'پدیکور ساده', slug: 'pedicure' },
          { name: 'پدیکور درمانی', slug: 'pedicure-medical' },
        ],
      },
    ],
    services: [],
  },
  {
    name: 'پوست',
    slug: 'skin',
    sortOrder: 3,
    children: [
      {
        name: 'پاکسازی و مراقبت',
        slug: 'skin-care',
        sortOrder: 1,
        services: [
          { name: 'پاکسازی پوست', slug: 'facial' },
          { name: 'فیشیال', slug: 'deep-facial' },
          { name: 'میکرودرم', slug: 'microderm' },
        ],
      },
      {
        name: 'زیبایی پوست',
        slug: 'skin-beauty',
        sortOrder: 2,
        services: [
          { name: 'مزوتراپی', slug: 'mesotherapy' },
          { name: 'لیفت صورت', slug: 'face-lift-session' },
        ],
      },
    ],
    services: [],
  },
  {
    name: 'آرایش',
    slug: 'makeup',
    sortOrder: 4,
    children: [
      {
        name: 'آرایش صورت',
        slug: 'face-makeup',
        sortOrder: 1,
        services: [
          { name: 'آرایش روزمره', slug: 'daily-makeup' },
          { name: 'آرایش مجلسی', slug: 'party-makeup' },
          { name: 'آرایش عروس', slug: 'bridal-makeup' },
        ],
      },
    ],
    services: [],
  },
  {
    name: 'ابرو و مژه',
    slug: 'brow-lash',
    sortOrder: 5,
    children: [
      {
        name: 'ابرو',
        slug: 'brow',
        sortOrder: 1,
        services: [
          { name: 'اصلاح ابرو', slug: 'brow-trim' },
          { name: 'میکروبلیدینگ ابرو', slug: 'microblading' },
        ],
      },
      {
        name: 'مژه',
        slug: 'lash',
        sortOrder: 2,
        services: [
          { name: 'اکستنشن مژه', slug: 'lash-extension' },
          { name: 'لیفت مژه', slug: 'lash-lift' },
        ],
      },
    ],
    services: [],
  },
];

async function upsertCategory({ name, slug, sortOrder, parentId }) {
  return prisma.serviceCategory.upsert({
    where: { slug },
    update: { name, sortOrder, isActive: true, parentId: parentId || null },
    create: {
      name,
      slug,
      sortOrder,
      isActive: true,
      parentId: parentId || null,
    },
  });
}

async function upsertService({ name, slug, categoryId }) {
  return prisma.service.upsert({
    where: { slug },
    update: { name, categoryId, isActive: true },
    create: { name, slug, categoryId, isActive: true },
  });
}

async function main() {
  let count = 0;
  for (const cat of CATALOG) {
    const parent = await upsertCategory({
      name: cat.name,
      slug: cat.slug,
      sortOrder: cat.sortOrder,
    });
    for (const s of cat.services || []) {
      await upsertService({ ...s, categoryId: parent.id });
      count++;
    }
    for (const child of cat.children || []) {
      const row = await upsertCategory({
        name: child.name,
        slug: child.slug,
        sortOrder: child.sortOrder,
        parentId: parent.id,
      });
      for (const s of child.services || []) {
        await upsertService({ ...s, categoryId: row.id });
        count++;
      }
    }
  }
  console.log(`Catalog seed OK — ${count} services upserted`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
