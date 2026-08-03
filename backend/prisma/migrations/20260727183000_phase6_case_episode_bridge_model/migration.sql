CREATE TYPE "CaseEpisodeStatus" AS ENUM ('open', 'closed');

CREATE TABLE "case_episodes" (
  "id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "opened_by_user_id" UUID,
  "source_applicant_application_id" UUID,
  "title" VARCHAR(255) NOT NULL,
  "summary" TEXT,
  "crisis_started_at" DATE,
  "status" "CaseEpisodeStatus" NOT NULL DEFAULT 'open',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "case_episodes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cases"
ADD COLUMN "case_episode_id" UUID;

CREATE UNIQUE INDEX "case_episodes_source_applicant_application_id_key"
ON "case_episodes"("source_applicant_application_id");

CREATE INDEX "case_episodes_client_id_created_at_idx"
ON "case_episodes"("client_id", "created_at");

CREATE INDEX "case_episodes_status_updated_at_idx"
ON "case_episodes"("status", "updated_at");

CREATE INDEX "cases_case_episode_id_idx"
ON "cases"("case_episode_id");

ALTER TABLE "case_episodes"
ADD CONSTRAINT "case_episodes_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "case_episodes"
ADD CONSTRAINT "case_episodes_opened_by_user_id_fkey"
FOREIGN KEY ("opened_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "case_episodes"
ADD CONSTRAINT "case_episodes_source_applicant_application_id_fkey"
FOREIGN KEY ("source_applicant_application_id") REFERENCES "applicant_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cases"
ADD CONSTRAINT "cases_case_episode_id_fkey"
FOREIGN KEY ("case_episode_id") REFERENCES "case_episodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
