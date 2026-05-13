DO $$
BEGIN
  CREATE TYPE "ApplicantApplicationStatus" AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'disapproved', 'released');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "applicant_applications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "applicant_id" UUID NOT NULL,
  "assistance_type" "AssistanceType" NOT NULL,
  "status" "ApplicantApplicationStatus" NOT NULL DEFAULT 'draft',
  "reference_number" VARCHAR(30),
  "contact_number" VARCHAR(20),
  "preferred_schedule" TIMESTAMPTZ(6),
  "reason" TEXT,
  "household_members" JSONB,
  "metadata" JSONB,
  "submitted_at" TIMESTAMPTZ(6),
  "reviewed_at" TIMESTAMPTZ(6),
  "admin_notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "applicant_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "applicant_application_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "document_type" VARCHAR(100) NOT NULL,
  "original_name" VARCHAR(255) NOT NULL,
  "file_url" TEXT NOT NULL,
  "mime_type" VARCHAR(100),
  "size_bytes" INTEGER,
  "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "applicant_application_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "applicant_applications_reference_number_key" ON "applicant_applications"("reference_number");
CREATE INDEX IF NOT EXISTS "applicant_applications_applicant_id_status_idx" ON "applicant_applications"("applicant_id", "status");
CREATE INDEX IF NOT EXISTS "applicant_applications_status_created_at_idx" ON "applicant_applications"("status", "created_at");
CREATE INDEX IF NOT EXISTS "applicant_application_documents_application_id_document_type_idx" ON "applicant_application_documents"("application_id", "document_type");

ALTER TABLE "applicant_applications"
  DROP CONSTRAINT IF EXISTS "applicant_applications_applicant_id_fkey";

ALTER TABLE "applicant_applications"
  ADD CONSTRAINT "applicant_applications_applicant_id_fkey"
  FOREIGN KEY ("applicant_id") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "applicant_application_documents"
  DROP CONSTRAINT IF EXISTS "applicant_application_documents_application_id_fkey";

ALTER TABLE "applicant_application_documents"
  ADD CONSTRAINT "applicant_application_documents_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "applicant_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
