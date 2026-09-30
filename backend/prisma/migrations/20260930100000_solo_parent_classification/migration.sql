-- Solo Parent joins 4Ps/PWD/Senior as a client classification. Case beneficiary
-- override stays nullable like the others (null = same as the registrant client).
ALTER TABLE "clients"
  ADD COLUMN "is_solo_parent" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "cases"
  ADD COLUMN "beneficiary_is_solo_parent" BOOLEAN;
