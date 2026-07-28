ALTER TABLE "system_settings" ADD COLUMN "client_start_sequence" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "system_settings" ADD COLUMN "medicine_start_sequence" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "system_settings" ADD COLUMN "burial_start_sequence" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "system_settings" ADD COLUMN "hospital_start_sequence" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "system_settings" ADD COLUMN "medical_start_sequence" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "system_settings" ADD COLUMN "eyeglass_start_sequence" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "system_settings" ADD COLUMN "plain_start_sequence" INTEGER NOT NULL DEFAULT 1;
