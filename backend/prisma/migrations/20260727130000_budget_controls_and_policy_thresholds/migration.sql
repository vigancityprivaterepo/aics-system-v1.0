ALTER TABLE "cases"
  ADD COLUMN "budget_allocation_id" UUID,
  ADD COLUMN "budget_allocated_at" TIMESTAMPTZ(6);

ALTER TABLE "system_settings"
  ADD COLUMN "medicine_case_study_threshold" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "burial_case_study_threshold" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "hospital_case_study_threshold" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "medical_case_study_threshold" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "eyeglass_case_study_threshold" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "plain_case_study_threshold" DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

CREATE TABLE "budget_allocations" (
  "id" UUID NOT NULL,
  "assistance_type" "AssistanceType" NOT NULL,
  "allocation_year" INTEGER NOT NULL,
  "allocation_month" INTEGER NOT NULL,
  "allocated_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "budget_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "budget_allocations_assistance_type_allocation_year_allocatio_key"
  ON "budget_allocations"("assistance_type", "allocation_year", "allocation_month");

CREATE INDEX "budget_allocations_allocation_year_allocation_month_idx"
  ON "budget_allocations"("allocation_year", "allocation_month");

CREATE INDEX "cases_budget_allocation_id_idx"
  ON "cases"("budget_allocation_id");

ALTER TABLE "cases"
  ADD CONSTRAINT "cases_budget_allocation_id_fkey"
  FOREIGN KEY ("budget_allocation_id") REFERENCES "budget_allocations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
