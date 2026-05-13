ALTER TABLE "clients"
ADD COLUMN IF NOT EXISTS "applicant_id" UUID;

ALTER TABLE "clients"
DROP CONSTRAINT IF EXISTS "clients_applicant_id_fkey";

ALTER TABLE "clients"
ADD CONSTRAINT "clients_applicant_id_fkey"
FOREIGN KEY ("applicant_id") REFERENCES "applicants"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "clients_applicant_id_key" ON "clients"("applicant_id");
