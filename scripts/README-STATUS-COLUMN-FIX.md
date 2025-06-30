# Status Column Migration Fix

## Issue
The `users.status` column is currently a BOOLEAN type but needs to be converted to an ENUM type to support string-based status values like 'active', 'pending', 'suspended', 'banned', 'deleted'.

## Error
```
invalid input syntax for type boolean: "active" (error code 22P02)
```

## Manual Fix
If the automatic migration fails during deployment, run the following SQL script directly on your PostgreSQL database:

### Option 1: Run the SQL file
```bash
psql -d your_database_name -f scripts/fix-status-column.sql
```

### Option 2: Run SQL commands manually
Connect to your PostgreSQL database and execute:

```sql
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
```

## Verification
After running the migration, verify it worked:

```sql
-- Check column type
SELECT 
    column_name, 
    data_type, 
    udt_name, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'status';

-- Test query
SELECT COUNT(*) as active_users FROM "users" WHERE "status" = 'active';
```

## Expected Result
- Column type should be `USER-DEFINED` with `udt_name` = `enum_users_status`
- Default value should be `'active'::enum_users_status`
- NOT NULL constraint should be applied
- Queries with string status values should work without errors

