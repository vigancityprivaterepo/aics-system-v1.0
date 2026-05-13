ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "signature_param" VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS "users_signature_param_key" ON "users"("signature_param");
