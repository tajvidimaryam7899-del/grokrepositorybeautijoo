-- Additive: preferred root categories for professional specialties (wizard + panel)
ALTER TABLE "professionals"
  ADD COLUMN IF NOT EXISTS "preferred_root_category_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
