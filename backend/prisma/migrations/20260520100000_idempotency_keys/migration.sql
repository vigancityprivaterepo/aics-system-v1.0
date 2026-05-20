CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scope" VARCHAR(120) NOT NULL,
  "key" VARCHAR(255) NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  "response_status" INTEGER,
  "response_body" JSONB,
  "completed_at" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_keys_scope_key_key" ON "idempotency_keys"("scope", "key");
CREATE INDEX IF NOT EXISTS "idempotency_keys_status_expires_at_idx" ON "idempotency_keys"("status", "expires_at");
