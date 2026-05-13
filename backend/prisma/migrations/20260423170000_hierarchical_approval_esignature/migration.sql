DO $$
BEGIN
  ALTER TYPE "CaseStatus" ADD VALUE IF NOT EXISTS 'recommending_approval';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "CaseStatus" ADD VALUE IF NOT EXISTS 'for_approval';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ApprovalLevel" AS ENUM ('none', 'reviewer', 'recommender', 'approver');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ApprovalStage" AS ENUM ('for_review', 'recommending_approval', 'for_approval');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ApprovalAction" AS ENUM ('approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "approval_level" "ApprovalLevel" NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "e_signature_url" TEXT,
  ADD COLUMN IF NOT EXISTS "e_signature_uploaded_at" TIMESTAMPTZ(6);

ALTER TABLE "system_settings"
  ADD COLUMN IF NOT EXISTS "reviewed_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "recommending_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "approved_by_user_id" UUID;

ALTER TABLE "system_settings"
  DROP CONSTRAINT IF EXISTS "system_settings_reviewed_by_user_id_fkey",
  DROP CONSTRAINT IF EXISTS "system_settings_recommending_user_id_fkey",
  DROP CONSTRAINT IF EXISTS "system_settings_approved_by_user_id_fkey";

ALTER TABLE "system_settings"
  ADD CONSTRAINT "system_settings_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "system_settings_recommending_user_id_fkey"
    FOREIGN KEY ("recommending_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "system_settings_approved_by_user_id_fkey"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "case_approvals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "case_id" UUID NOT NULL,
  "stage" "ApprovalStage" NOT NULL,
  "acted_by_user_id" UUID,
  "acted_by_name" VARCHAR(200) NOT NULL,
  "acted_by_title" VARCHAR(120),
  "signature_url_snapshot" TEXT,
  "acted_at" TIMESTAMPTZ(6) NOT NULL,
  "action" "ApprovalAction" NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "case_approvals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "case_approvals_case_id_stage_key" ON "case_approvals"("case_id", "stage");
CREATE INDEX IF NOT EXISTS "case_approvals_case_id_acted_at_idx" ON "case_approvals"("case_id", "acted_at");

ALTER TABLE "case_approvals"
  DROP CONSTRAINT IF EXISTS "case_approvals_case_id_fkey",
  DROP CONSTRAINT IF EXISTS "case_approvals_acted_by_user_id_fkey";

ALTER TABLE "case_approvals"
  ADD CONSTRAINT "case_approvals_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "case_approvals_acted_by_user_id_fkey"
    FOREIGN KEY ("acted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
