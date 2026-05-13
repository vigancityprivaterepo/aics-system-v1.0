ALTER TABLE "applicant_applications"
ADD COLUMN IF NOT EXISTS "case_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'applicant_applications_case_id_fkey'
  ) THEN
    ALTER TABLE "applicant_applications"
    ADD CONSTRAINT "applicant_applications_case_id_fkey"
      FOREIGN KEY ("case_id") REFERENCES "cases"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "applicant_applications_case_id_key"
ON "applicant_applications"("case_id");
