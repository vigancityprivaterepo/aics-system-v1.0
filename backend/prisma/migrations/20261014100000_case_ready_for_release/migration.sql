-- Approval no longer means the assistance can be claimed yet (e.g. medicines
-- still have to be purchased). A case maker marks approved cases as ready for
-- release, which is also when the client is texted. Null = not marked yet.
ALTER TABLE "cases"
  ADD COLUMN "ready_for_release_at" TIMESTAMPTZ(6),
  ADD COLUMN "ready_for_release_by_name" VARCHAR(200);
