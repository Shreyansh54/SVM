"""
Append the collections table to the existing SQL export file (retry after deadlock).
"""
import psycopg2
import psycopg2.extras
from datetime import date, datetime
import time

SOURCE_URL = "postgresql://vollora:wA39qEgWewHrqzJN0Upc66Kv9CoS9uA5@dpg-d870fjmq1p3s73ch093g-a.oregon-postgres.render.com/vollora"

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

def export_table_with_retry(table, max_retries=5):
    for attempt in range(max_retries):
        try:
            conn = psycopg2.connect(SOURCE_URL, connect_timeout=30)
            conn.set_session(autocommit=True)
            cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]

            if count == 0:
                conn.close()
                return [], []

            cur.execute(f"SELECT * FROM {table} LIMIT 0")
            col_names = [desc[0] for desc in cur.description]

            cur.execute(f"SELECT * FROM {table}")
            rows = cur.fetchall()
            conn.close()
            return col_names, rows

        except psycopg2.errors.DeadlockDetected:
            print(f"  ⚠️  Deadlock on attempt {attempt+1}, retrying in 3s...")
            time.sleep(3)
        except Exception as e:
            print(f"  ❌ Error: {e}")
            time.sleep(3)

    return [], []

def main():
    print("🔌 Connecting to Render to export 'collections'...")

    lines = []
    lines.append("")
    lines.append("-- Table: collections")

    col_names, rows = export_table_with_retry("collections")

    if not rows:
        print("  ⏭️  collections: empty or failed")
        lines.append("-- collections: empty or failed to export")
    else:
        print(f"  📋 collections: {len(rows)} rows...", end=" ", flush=True)
        lines.append("TRUNCATE TABLE collections CASCADE;")
        for row in rows:
            vals = ", ".join(escape_val(v) for v in row)
            cols = ", ".join(col_names)
            lines.append(f"INSERT INTO collections ({cols}) VALUES ({vals});")
        lines.append("SELECT setval(pg_get_serial_sequence('collections', 'id'), COALESCE((SELECT MAX(id) FROM collections), 1));")
        print("✅ done")

    lines.append("")
    lines.append("-- Re-enable triggers")
    lines.append("SET session_replication_role = DEFAULT;")
    lines.append("")
    lines.append(f"-- Migration complete!")

    # Read existing file up to (but not including) the re-enable triggers line
    with open("supabase_import.sql", "r", encoding="utf-8") as f:
        content = f.read()

    # Remove trailing re-enable block if it was partially written
    cutoff_markers = [
        "-- Re-enable triggers",
        "SET session_replication_role = DEFAULT;",
    ]
    for marker in cutoff_markers:
        idx = content.rfind(marker)
        if idx != -1:
            content = content[:idx].rstrip()
            break

    # Append collections + re-enable triggers
    with open("supabase_import.sql", "w", encoding="utf-8") as f:
        f.write(content + "\n" + "\n".join(lines))

    import os
    size_kb = os.path.getsize("supabase_import.sql") / 1024
    print(f"\n✅ supabase_import.sql is ready! ({size_kb:.1f} KB)")
    print(f"\n📋 NEXT STEPS:")
    print(f"   1. Update Render's DATABASE_URL to the Supabase URL")
    print(f"   2. Deploy backend → it will auto-create all tables in Supabase")
    print(f"   3. Go to Supabase → SQL Editor → paste supabase_import.sql → Run")

if __name__ == "__main__":
    main()
