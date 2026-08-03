ALTER TYPE "CaseOverrideType" ADD VALUE IF NOT EXISTS 'repeat_assistance';

CREATE TYPE "IssuedDocumentKind" AS ENUM ('guarantee_letter', 'case_study');

ALTER TABLE "system_settings"
  ADD COLUMN "repeat_assistance_cooldown_days" INTEGER NOT NULL DEFAULT 90;

CREATE TABLE "document_verification_issues" (
  "id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "kind" "IssuedDocumentKind" NOT NULL,
  "verification_code" VARCHAR(20) NOT NULL,
  "issued_case_number" VARCHAR(30) NOT NULL,
  "issued_assistance_type" "AssistanceType" NOT NULL,
  "issued_status" "CaseStatus" NOT NULL,
  "issued_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  "issued_client_name" VARCHAR(255) NOT NULL,
  "issued_beneficiary_name" VARCHAR(255),
  "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(6),
  "metadata" JSONB,

  CONSTRAINT "document_verification_issues_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_verification_issues_case_id_kind_issued_at_idx"
  ON "document_verification_issues"("case_id", "kind", "issued_at");

CREATE INDEX "document_verification_issues_kind_issued_at_idx"
  ON "document_verification_issues"("kind", "issued_at");

ALTER TABLE "document_verification_issues"
  ADD CONSTRAINT "document_verification_issues_case_id_fkey"
  FOREIGN KEY ("case_id") REFERENCES "cases"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
