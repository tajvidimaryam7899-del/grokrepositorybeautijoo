-- AlterTable (additive, non-destructive)
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "slot_interval_min" INTEGER NOT NULL DEFAULT 30;
