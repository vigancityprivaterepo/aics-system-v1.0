ALTER TABLE "cases"
  ADD COLUMN "beneficiary_name" VARCHAR(200),
  ADD COLUMN "beneficiary_age" VARCHAR(20),
  ADD COLUMN "beneficiary_sex" VARCHAR(10),
  ADD COLUMN "beneficiary_civil_status" VARCHAR(20),
  ADD COLUMN "beneficiary_occupation" VARCHAR(200),
  ADD COLUMN "beneficiary_requestor_name" VARCHAR(200),
  ADD COLUMN "beneficiary_requestor_relationship" VARCHAR(100);
