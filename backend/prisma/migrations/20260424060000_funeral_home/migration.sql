ALTER TABLE "burial_details" ADD COLUMN IF NOT EXISTS "funeral_home_owner" VARCHAR(200);
ALTER TABLE "burial_details" ADD COLUMN IF NOT EXISTS "funeral_owner_address" VARCHAR(300);

CREATE TABLE IF NOT EXISTS "funeral_homes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(200) NOT NULL,
  "owner_name" VARCHAR(200),
  "address" VARCHAR(300),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "funeral_homes_pkey" PRIMARY KEY ("id")
);
