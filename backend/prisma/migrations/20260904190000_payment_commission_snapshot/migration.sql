-- Additive-only: commission snapshot columns for financial admin panel.
-- No column dropped/renamed/retyped, no table touched besides this ADD COLUMN,
-- no existing data modified. All three are nullable with no DEFAULT, so every
-- existing row gets NULL (meaning "no snapshot"), never a fabricated 0.
ALTER TABLE "payments" ADD COLUMN "platform_commission_rate" DECIMAL(5,2);
ALTER TABLE "payments" ADD COLUMN "platform_commission_amount" INTEGER;
ALTER TABLE "payments" ADD COLUMN "professional_net_amount" INTEGER;
