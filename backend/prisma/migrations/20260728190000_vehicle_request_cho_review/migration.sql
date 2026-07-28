ALTER TABLE "vehicle_requests"
ADD COLUMN "cho_reviewed_by_id" UUID,
ADD COLUMN "cho_reviewed_by_name" VARCHAR(200),
ADD COLUMN "cho_reviewed_at" TIMESTAMPTZ(6);

ALTER TABLE "vehicle_requests" ALTER COLUMN "status" SET DEFAULT 'pending_cho_review';

CREATE INDEX "vehicle_requests_cho_reviewed_by_id_idx"
ON "vehicle_requests"("cho_reviewed_by_id");

ALTER TABLE "vehicle_requests"
ADD CONSTRAINT "vehicle_requests_cho_reviewed_by_id_fkey"
FOREIGN KEY ("cho_reviewed_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "vehicle_requests" SET "status" = 'pending_cho_review' WHERE "vehicle_type" = 'ambulance' AND "status" = 'draft';
UPDATE "vehicle_requests" SET "status" = 'cho_reviewed' WHERE "vehicle_type" = 'ambulance' AND "status" = 'processed';