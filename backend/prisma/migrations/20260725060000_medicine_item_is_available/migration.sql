-- Add is_available column to medicine_items table
ALTER TABLE "medicine_items" ADD COLUMN IF NOT EXISTS "is_available" BOOLEAN NOT NULL DEFAULT true;
