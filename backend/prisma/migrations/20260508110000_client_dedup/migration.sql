ALTER TABLE "clients"
  ADD COLUMN "merged_into_client_id" UUID,
  ADD COLUMN "merged_at" TIMESTAMPTZ(6),
  ADD COLUMN "merged_by_user_id" UUID;

CREATE INDEX "clients_merged_into_client_id_idx" ON "clients"("merged_into_client_id");

ALTER TABLE "clients"
  ADD CONSTRAINT "clients_merged_into_client_id_fkey"
  FOREIGN KEY ("merged_into_client_id") REFERENCES "clients"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "client_dedup_events" (
  "id" UUID NOT NULL,
  "actor_id" UUID,
  "applicant_id" UUID,
  "source_client_id" UUID,
  "target_client_id" UUID,
  "action" VARCHAR(60) NOT NULL,
  "notes" TEXT,
  "payload" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "client_dedup_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_dedup_events_source_client_id_created_at_idx" ON "client_dedup_events"("source_client_id", "created_at");
CREATE INDEX "client_dedup_events_target_client_id_created_at_idx" ON "client_dedup_events"("target_client_id", "created_at");
CREATE INDEX "client_dedup_events_applicant_id_created_at_idx" ON "client_dedup_events"("applicant_id", "created_at");
