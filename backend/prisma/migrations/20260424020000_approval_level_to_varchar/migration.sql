DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'approval_level'
      AND udt_name = 'ApprovalLevel'
  ) THEN
    ALTER TABLE "users" ALTER COLUMN "approval_level" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "approval_level" TYPE VARCHAR(100) USING "approval_level"::text;
    ALTER TABLE "users" ALTER COLUMN "approval_level" SET DEFAULT 'none';
  END IF;
END $$;

DROP TYPE IF EXISTS "ApprovalLevel";
