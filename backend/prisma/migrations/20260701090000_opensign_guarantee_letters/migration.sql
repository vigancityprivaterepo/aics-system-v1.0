ALTER TABLE "burial_details"
  ADD COLUMN IF NOT EXISTS "opensign_document_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "opensign_status" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "opensign_sign_url" TEXT,
  ADD COLUMN IF NOT EXISTS "opensign_sent_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "opensign_signed_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "burial_details_opensign_document_id_idx"
  ON "burial_details"("opensign_document_id");

ALTER TABLE "hospital_details"
  ADD COLUMN IF NOT EXISTS "opensign_document_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "opensign_status" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "opensign_sign_url" TEXT,
  ADD COLUMN IF NOT EXISTS "opensign_sent_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "opensign_signed_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "hospital_details_opensign_document_id_idx"
  ON "hospital_details"("opensign_document_id");

ALTER TABLE "medical_details"
  ADD COLUMN IF NOT EXISTS "opensign_document_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "opensign_status" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "opensign_sign_url" TEXT,
  ADD COLUMN IF NOT EXISTS "opensign_sent_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "opensign_signed_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "medical_details_opensign_document_id_idx"
  ON "medical_details"("opensign_document_id");

ALTER TABLE "eyeglass_details"
  ADD COLUMN IF NOT EXISTS "opensign_document_id" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "opensign_status" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "opensign_sign_url" TEXT,
  ADD COLUMN IF NOT EXISTS "opensign_sent_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "opensign_signed_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "eyeglass_details_opensign_document_id_idx"
  ON "eyeglass_details"("opensign_document_id");
