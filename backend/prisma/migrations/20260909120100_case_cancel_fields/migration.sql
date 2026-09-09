ALTER TABLE "cases" ADD COLUMN "cancelled_at" TIMESTAMPTZ(6);
ALTER TABLE "cases" ADD COLUMN "cancel_reason" TEXT;
ALTER TABLE "cases" ADD COLUMN "cancelled_by_user_id" UUID;

ALTER TABLE "cases" ADD CONSTRAINT "cases_cancelled_by_user_id_fkey"
  FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
