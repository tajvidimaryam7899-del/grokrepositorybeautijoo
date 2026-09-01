# Catalog Duplicate Report

**Date:** 2026-09-01  
**Commit baseline:** `4e7e4d5` + follow-up pricing/addons work  
**Environment:** No live Production/Staging database available in verification sandbox.

## Seed source of truth

`backend/prisma/seed-catalog.cjs` defines **19 root categories** with **unique slugs**:

| name | slug |
|------|------|
| کوتاهی | cut |
| رنگ و لایت | color-light |
| کراتین، فر و احیا | keratin-perm-restore |
| ناخن | nails |
| مژه | lashes |
| ابرو | brows |
| پوست و فیشال | skin-facial |
| میکاپ و گریم | makeup-grooming |
| اصلاح | shaping |
| اپیلاسیون | epilation |
| ماساژ | massage |
| اسپا | spa |
| آرایش دائم | permanent-makeup |
| تتو | tattoo |
| اکستنشن و بافت | extension-braid |
| خدمات آقایان | mens-services |
| خدمات کودک | kids-services |
| خدمات عروس | bridal-services |
| خدمات داماد | groom-services |

Sample hierarchy under `nails` uses unique slugs (`nails-extension`, `nails-gel-extension`, …). Seed is **idempotent upsert by slug**.

## API safeguard (already in place)

- `POST /categories` and `POST /services` are **admin-only** (`@Roles('admin')`).
- Professionals cannot create global taxonomy nodes.

## Live DB merge status

**Not executed** — no `DATABASE_URL` / Postgres in this environment.

### Required before any merge/delete on Production

```
Duplicate candidates
- existing record
- canonical record
- dependent records (ProfessionalService, MediaAsset, BookingItem, ServiceAddOn, rules)
- affected professionals
- affected services
- affected media
- affected bookings
```

Query checklist (run on Production/Staging only):

```sql
-- Same name, different slug
SELECT name, COUNT(*), array_agg(slug), array_agg(id)
FROM service_categories
GROUP BY name HAVING COUNT(*) > 1;

SELECT name, COUNT(*), array_agg(slug), array_agg(id)
FROM services
GROUP BY name HAVING COUNT(*) > 1;

-- Same slug should already be unique (@@unique)
```

**Policy:** Do not delete/merge by name alone. Only re-point FKs to a canonical row after dependency counts are zero-risk, then soft-disable or delete the duplicate.

## Recommendation

1. Deploy seed + admin-only create (already committed).
2. On Production: run the SQL above; attach dependency counts.
3. If duplicates exist only from earlier pro-created taxonomy, merge under ops supervision.
4. No automatic destructive migration in this release.
