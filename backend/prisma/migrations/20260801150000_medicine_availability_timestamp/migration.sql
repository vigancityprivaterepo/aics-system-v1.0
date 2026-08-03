ALTER TABLE "medicine_items"
ADD COLUMN IF NOT EXISTS "availability_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "medicine_items"
SET "availability_updated_at" = COALESCE("updated_at", "availability_updated_at", CURRENT_TIMESTAMP);
