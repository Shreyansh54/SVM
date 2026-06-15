"""
Export all data from Render PostgreSQL as SQL INSERT statements.
Writes incrementally so a crash doesn't lose everything.
"""
import psycopg2
import psycopg2.extras
from datetime import date, datetime
import time
import os

SOURCE_URL = "postgresql://vollora:wA39qEgWewHrqzJN0Upc66Kv9CoS9uA5@dpg-d870fjmq1p3s73ch093g-a.oregon-postgres.render.com/vollora"

TABLE_ORDER = [
    "employees", "stockists", "products", "batches", "stock",
    "doctors", "users", "sales", "attendance", "salaries",
    "doctor_prescriptions", "doctor_orders", "audit_logs", "collections",
]

def escape_val(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (date, datetime)):
        return f"'{v.isoformat()}'"
    escaped = str(v).replace("'", "''")
    return f"'{escaped}'"

def export_table(table, max_retries=5):
    for attempt in range(max_retries):
        try:
            conn = psycopg2.connect(SOURCE_URL, connect_timeout=30)
            conn.set_session(autocommit=True)  # Prevents deadlocks
            cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]
            if count == 0:
                conn.close()
                return None, None, 0

            cur.execute(f"SELECT * FROM {table} LIMIT 0")
            col_names = [desc[0] for desc in cur.description]

            cur.execute(f"SELECT * FROM {table}")
            rows = cur.fetchall()
            conn.close()
            return col_names, rows, count

        except Exception as e:
            print(f"\n  ⚠️  Attempt {attempt+1} failed for {table}: {e}")
            time.sleep(3 * (attempt + 1))

    return None, None, 0

def main():
    print("🔌 Connecting to Render...")
    # Quick connection test
    test_conn = psycopg2.connect(SOURCE_URL, connect_timeout=30)
    test_conn.close()
    print("✅ Connected!\n")

    output_path = "supabase_import.sql"
    total_rows = 0

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("-- ============================================\n")
        f.write("-- ESSMS Database Export: Render → Supabase\n")
        f.write(f"-- Generated: {datetime.now().isoformat()}\n")
        f.write("-- ============================================\n\n")
        f.write("SET session_replication_role = replica;\n\n")

        for table in TABLE_ORDER:
            # Check table exists
            try:
                check_conn = psycopg2.connect(SOURCE_URL, connect_timeout=30)
                check_conn.set_session(autocommit=True)
                check_cur = check_conn.cursor()
                check_cur.execute("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = %s)", (table,))
                exists = check_cur.fetchone()[0]
                check_conn.close()
            except:
                exists = False

            if not exists:
                print(f"  ⚠️  Skipping '{table}' (not found)")
                continue

            col_names, rows, count = export_table(table)

            if count == 0 or rows is None:
                print(f"  ⏭️  {table}: empty")
                f.write(f"-- Table: {table} (empty)\n\n")
                f.flush()
                continue

            print(f"  📋 {table}: {count} rows...", end=" ", flush=True)

            f.write(f"-- Table: {table} ({count} rows)\n")
            f.write(f"TRUNCATE TABLE {table} CASCADE;\n")

            for row in rows:
                vals = ", ".join(escape_val(v) for v in row)
                cols = ", ".join(col_names)
                f.write(f"INSERT INTO {table} ({cols}) VALUES ({vals});\n")

            f.write(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE((SELECT MAX(id) FROM {table}), 1));\n\n")
            f.flush()  # Write to disk immediately
            total_rows += count
            print("✅")

        f.write("SET session_replication_role = DEFAULT;\n\n")
        f.write(f"-- Done! {total_rows} rows exported.\n")

    size_kb = os.path.getsize(output_path) / 1024
    print(f"\n✅ Export complete! {total_rows} rows → supabase_import.sql ({size_kb:.1f} KB)")
    print(f"\n📋 NEXT STEPS:")
    print(f"   1. Go to Supabase → SQL Editor (left sidebar)")
    print(f"   2. Click '+ New query'")
    print(f"   3. Paste the contents of backend/supabase_import.sql")
    print(f"   4. Click Run")
    print(f"\n   Then update Render's DATABASE_URL env var to:")
    print(f"   postgresql://postgres.gwovavxknhcmjnqobsmp:[password]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres")

if __name__ == "__main__":
    main()
