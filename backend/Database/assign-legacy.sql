-- psql -v shop_id=42 -f assign-legacy.sql
-- Use only after verifying all unassigned rows belong to this single, approved store.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE chosen_store ON COMMIT DROP AS SELECT "Id" FROM "Shops"
 WHERE "Id" = :'shop_id'::integer AND "Status"='Active' AND ("ExpiresAt" IS NULL OR "ExpiresAt">now()) FOR UPDATE;
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM chosen_store) THEN RAISE EXCEPTION 'Choose an approved, active store'; END IF;
END $$;
UPDATE "Products" SET "ShopId"=(SELECT "Id" FROM chosen_store) WHERE "ShopId" IS NULL;
UPDATE "Orders" SET "ShopId"=(SELECT "Id" FROM chosen_store) WHERE "ShopId" IS NULL;
COMMIT;
