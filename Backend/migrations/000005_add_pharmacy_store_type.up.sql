DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'store_category_type' AND e.enumlabel = 'PHARMACY'
    ) THEN
        ALTER TYPE store_category_type ADD VALUE 'PHARMACY';
    END IF;
END $$;
