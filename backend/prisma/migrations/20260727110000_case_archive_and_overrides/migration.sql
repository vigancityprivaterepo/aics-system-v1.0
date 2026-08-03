CREATE TYPE "CaseOverrideType" AS ENUM ('workflow_submission', 'amount_mismatch');

ALTER TABLE "cases"
ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "archived_at" TIMESTAMPTZ(6),
ADD COLUMN "archived_by_user_id" UUID,
ADD COLUMN "archive_reason" TEXT;

ALTER TABLE "cases"
ADD CONSTRAINT "cases_archived_by_user_id_fkey"
FOREIGN KEY ("archived_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE TABLE "case_overrides" (
  "id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "created_by_user_id" UUID,
  "override_type" "CaseOverrideType" NOT NULL,
  "reason" TEXT NOT NULL,
  "context" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "case_overrides_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "case_overrides"
ADD CONSTRAINT "case_overrides_case_id_fkey"
FOREIGN KEY ("case_id") REFERENCES "cases"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "case_overrides"
ADD CONSTRAINT "case_overrides_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "cases_is_archived_status_idx" ON "cases"("is_archived", "status");
CREATE INDEX "case_overrides_case_id_created_at_idx" ON "case_overrides"("case_id", "created_at");
CREATE INDEX "case_overrides_override_type_created_at_idx" ON "case_overrides"("override_type", "created_at");
