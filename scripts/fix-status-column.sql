-- Fix users.status column from BOOLEAN to ENUM
-- Run this script directly on your PostgreSQL database

-- Drop constraints first
ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "status" DROP NOT NULL;

-- 🔧 Convert to TEXT
ALTER TABLE "users" ALTER COLUMN "status" TYPE TEXT;

-- Safely create enum type
DO $$
BEGIN
  CREATE TYPE "public"."enum_users_status" AS ENUM (
    'active', 'pending', 'suspended', 'banned', 'deleted'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 🔄 Convert from TEXT to ENUM
ALTER TABLE "users"
  ALTER COLUMN "status"
  TYPE "public"."enum_users_status"
  USING ("status"::"public"."enum_users_status");

-- Reapply constraints
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active';
ALTER TABLE "users" ALTER COLUMN "status" SET NOT NULL;

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    udt_name, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'status';

-- Test query to ensure it works
SELECT COUNT(*) as active_users FROM "users" WHERE "status" = 'active';