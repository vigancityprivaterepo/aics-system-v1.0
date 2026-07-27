ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "rfid_uid" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "clients_rfid_uid_key" ON "clients"("rfid_uid");
CREATE INDEX IF NOT EXISTS "clients_rfid_uid_idx" ON "clients"("rfid_uid");
