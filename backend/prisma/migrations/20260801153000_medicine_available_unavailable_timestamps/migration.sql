ALTER TABLE "medicine_items"
ADD COLUMN IF NOT EXISTS "available_updated_at" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "unavailable_updated_at" TIMESTAMPTZ(6);

UPDATE "medicine_items"
SET
  "available_updated_at" = CASE
    WHEN "is_available" = TRUE THEN COALESCE("availability_updated_at", "updated_at", "created_at", CURRENT_TIMESTAMP)
    ELSE "available_updated_at"
  END,
  "unavailable_updated_at" = CASE
    WHEN "is_available" = FALSE THEN COALESCE("availability_updated_at", "updated_at", "created_at", CURRENT_TIMESTAMP)
    ELSE "unavailable_updated_at"
  END;
