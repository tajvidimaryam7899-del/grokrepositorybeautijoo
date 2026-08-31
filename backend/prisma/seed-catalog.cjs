/**
 * Production-safe catalog seed (categories + optional sample hierarchy).
 * Idempotent upserts — safe to run on every deploy/start.
 *
 * Root categories are the 19 Beautijoo service families.
 * Hierarchy is dynamic (parentId) — professionals can add deeper nodes later.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/** 19 root categories — hard-coded seed only; structure remains dynamic */
const ROOT_CATEGORIES = [
  { name: '\u06a9\u0648\u062a\u0627\u0647\u06cc', slug: 'cut', sortOrder: 1 },
  { name: '\u0631\u0646\u06af \u0648 \u0644\u0627\u06cc\u062a', slug: 'color-light', sortOrder: 2 },
  { name: '\u06a9\u0631\u0627\u062a\u06cc\u0646\u060c \u0641\u0631 \u0648 \u0627\u062d\u06cc\u0627', slug: 'keratin-perm-restore', sortOrder: 3 },
  { name: '\u0646\u0627\u062e\u0646', slug: 'nails', sortOrder: 4 },
  { name: '\u0645\u0698\u0647', slug: 'lashes', sortOrder: 5 },
  { name: '\u0627\u0628\u0631\u0648', slug: 'brows', sortOrder: 6 },
  { name: '\u067e\u0648\u0633\u062a \u0648 \u0641\u06cc\u0634\u06cc\u0627\u0644', slug: 'skin-facial', sortOrder: 7 },
  { name: '\u0645\u06cc\u06a9\u0627\u067e \u0648 \u06af\u0631\u06cc\u0645', slug: 'makeup-grooming', sortOrder: 8 },
  { name: '\u0627\u0635\u0644\u0627\u062d', slug: 'shaping', sortOrder: 9 },
  { name: '\u0627\u067e\u06cc\u0644\u0627\u0633\u06cc\u0648\u0646', slug: 'epilation', sortOrder: 10 },
  { name: '\u0645\u0627\u0633\u0627\u0698', slug: 'massage', sortOrder: 11 },
  { name: '\u0627\u0633\u067e\u0627', slug: 'spa', sortOrder: 12 },
  { name: '\u0622\u0631\u0627\u06cc\u0634 \u062f\u0627\u0626\u0645', slug: 'permanent-makeup', sortOrder: 13 },
  { name: '\u062a\u062a\u0648', slug: 'tattoo', sortOrder: 14 },
  { name: '\u0627\u06a9\u0633\u062a\u0646\u0634\u0646 \u0648 \u0628\u0627\u0641\u062a', slug: 'extension-braid', sortOrder: 15 },
  { name: '\u062e\u062f\u0645\u0627\u062a \u0622\u0642\u0627\u06cc\u0627\u0646', slug: 'mens-services', sortOrder: 16 },
  { name: '\u062e\u062f\u0645\u0627\u062a \u06a9\u0648\u062f\u06a9', slug: 'kids-services', sortOrder: 17 },
  { name: '\u062e\u062f\u0645\u0627\u062a \u0639\u0631\u0648\u0633', slug: 'bridal-services', sortOrder: 18 },
  { name: '\u062e\u062f\u0645\u0627\u062a \u062f\u0627\u0645\u0627\u062f', slug: 'groom-services', sortOrder: 19 },
];

/**
 * Optional sample multi-level hierarchy under \u0646\u0627\u062e\u0646 (nails)
 * to demonstrate unlimited depth: \u0646\u0627\u062e\u0646 \u2192 \u06a9\u0627\u0634\u062a \u2192 \u06a9\u0627\u0634\u062a \u0628\u0627 \u0698\u0644 \u2192 leaf services
 * Does not limit hierarchy depth elsewhere.
 */
const SAMPLE_HIERARCHY = [
  {
    parentSlug: 'nails',
    name: '\u06a9\u0627\u0634\u062a',
    slug: 'nails-extension',
    sortOrder: 1,
    children: [
      {
        name: '\u06a9\u0627\u0634\u062a \u0628\u0627 \u0698\u0644',
        slug: 'nails-gel-extension',
        sortOrder: 1,
        services: [
          { name: '\u06a9\u0627\u0634\u062a \u0698\u0644 \u0628\u0644\u0646\u062f', slug: 'nails-gel-long' },
          { name: '\u06a9\u0627\u0634\u062a \u0698\u0644 \u06a9\u0648\u062a\u0627\u0647', slug: 'nails-gel-short' },
        ],
      },
    ],
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

async function seedSampleBranch(node, parentId) {
  const row = await upsertCategory({
    name: node.name,
    slug: node.slug,
    sortOrder: node.sortOrder ?? 0,
    parentId,
  });
  let serviceCount = 0;
  for (const s of node.services || []) {
    await upsertService({ ...s, categoryId: row.id });
    serviceCount++;
  }
  for (const child of node.children || []) {
    serviceCount += await seedSampleBranch(child, row.id);
  }
  return serviceCount;
}

async function main() {
  let serviceCount = 0;

  for (const cat of ROOT_CATEGORIES) {
    await upsertCategory({
      name: cat.name,
      slug: cat.slug,
      sortOrder: cat.sortOrder,
    });
  }

  for (const branch of SAMPLE_HIERARCHY) {
    const parent = await prisma.serviceCategory.findUnique({
      where: { slug: branch.parentSlug },
    });
    if (!parent) {
      console.warn(`Parent category ${branch.parentSlug} not found, skip sample`);
      continue;
    }
    serviceCount += await seedSampleBranch(branch, parent.id);
  }

  console.log(
    `Catalog seed OK — ${ROOT_CATEGORIES.length} root categories, ${serviceCount} sample services`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
