"""Optional PostgreSQL migration test. Run only against a disposable QA database."""
import os
from pathlib import Path
from uuid import uuid4
import psycopg
from psycopg import sql

database = Path(__file__).resolve().parents[1] / "backend" / "Database"
conn = psycopg.connect(os.environ["QA_DB_DSN"])
try:
    schema = "nw_test_" + uuid4().hex
    conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
    conn.execute(sql.SQL("SET LOCAL search_path TO {}").format(sql.Identifier(schema)))
    # Columns from the original single-store schema touched by this upgrade.
    conn.execute('CREATE TABLE "Products" ("Id" serial PRIMARY KEY, "Name" text NOT NULL)')
    conn.execute('CREATE TABLE "Orders" ("Id" serial PRIMARY KEY, "Total" numeric NOT NULL,"CreatedAt" timestamptz NOT NULL DEFAULT now())')
    conn.execute('CREATE TABLE "OrderItems" ("Id" serial PRIMARY KEY, "OrderId" int REFERENCES "Orders", "UnitPrice" numeric NOT NULL)')
    conn.execute("""INSERT INTO "Products" ("Name") VALUES ('Legacy honey')""")
    conn.execute('INSERT INTO "Orders" ("Total") VALUES (200)')
    conn.execute('INSERT INTO "OrderItems" ("OrderId","UnitPrice") VALUES (1,100)')
    upgrade=(database/"upgrade.sql").read_text()
    conn.execute(upgrade)
    conn.execute(upgrade)
    assert conn.execute('SELECT "ShopId","Subtotal","City" FROM "Orders"').fetchone()==(None,200,"")
    assert conn.execute('SELECT "ListPrice","OrderId" FROM "OrderItems"').fetchone()==(100,1)
    conn.execute("""INSERT INTO "Shops" ("Name","AdminName","Slug","Email","PasswordHash","BrowserTitle","Status","ConfigJson")
        VALUES ('QA','QA','test','test@example.test','placeholder','QA','Active','{}')""")
    # Exercise the bundled assignment SQL within the outer rollback-only test transaction.
    assign=(database/"assign-legacy.sql").read_text()
    assign="\n".join(line for line in assign.splitlines() if not line.startswith(("--","\\")) and line.strip() not in ("BEGIN;","COMMIT;"))
    conn.execute(assign.replace(":'shop_id'","'1'"))
    assert conn.execute('SELECT "ShopId" FROM "Products"').fetchone()==(1,)
    assert conn.execute('SELECT "ShopId" FROM "Orders"').fetchone()==(1,)
    print("PASS legacy SQL upgrade twice, private unassigned records, original totals and explicit assignment")
finally:
    conn.rollback()
    conn.close()
