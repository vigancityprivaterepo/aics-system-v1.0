-- Snapshot of each case taken just before it is deleted.
CREATE TABLE "deleted_cases" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "case_number" VARCHAR(20),
    "assistance_type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "client_name" VARCHAR(300),
    "social_worker_name" VARCHAR(200),
    "deleted_by_id" UUID,
    "deleted_by_name" VARCHAR(200),
    "deleted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "deleted_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deleted_cases_case_number_idx" ON "deleted_cases"("case_number");
CREATE INDEX "deleted_cases_deleted_at_idx" ON "deleted_cases"("deleted_at");
