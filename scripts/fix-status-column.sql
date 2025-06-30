-- Fix users.status column from BOOLEAN to ENUM
-- Run this script directly on your PostgreSQL database

-- Step 1: Drop constraints and convert to TEXT
ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "status" TYPE TEXT;

-- Step 2: Create ENUM type safely
DO $$
BEGIN
    CREATE TYPE "public"."enum_users_status" AS ENUM (
        'active', 'pending', 'suspended', 'banned', 'deleted'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- Step 3: Convert column to ENUM
ALTER TABLE "users"
    ALTER COLUMN "status"
    TYPE "public"."enum_users_status"
    USING ("status"::"public"."enum_users_status");

-- Step 4: Restore constraints
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

