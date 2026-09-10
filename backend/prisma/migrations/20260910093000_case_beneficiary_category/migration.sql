-- Null means "same as the registrant client" and is resolved live at read time;
-- it's only set explicitly once a case's beneficiary is a different household
-- member, so no backfill of existing rows is needed.
ALTER TABLE "cases"
  ADD COLUMN "beneficiary_is_4ps" BOOLEAN,
  ADD COLUMN "beneficiary_is_pwd" BOOLEAN,
  ADD COLUMN "beneficiary_is_senior" BOOLEAN;
