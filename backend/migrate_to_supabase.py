"""
Migration script: Render PostgreSQL → Supabase PostgreSQL
Copies all tables row by row using SQLAlchemy.
"""

import sys
from sqlalchemy import create_engine, text, inspect, MetaData, Table
from sqlalchemy.orm import sessionmaker

# ── Connection strings ──────────────────────────────────────────────────────
SOURCE_URL = "postgresql://vollora:wA39qEgWewHrqzJN0Upc66Kv9CoS9uA5@dpg-d870fjmq1p3s73ch093g-a.oregon-postgres.render.com/vollora"
DEST_URL   = "postgresql://neondb_owner:npg_sWqEGM9Yz2Sd@ep-dark-breeze-aolvzoap.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# ── Migration order respects foreign key dependencies ──────────────────────
TABLE_ORDER = [
    "employees",
    "stockists",
    "products",
    "batches",
    "stock",
    "doctors",
    "users",
    "sales",
    "attendance",
    "salaries",
    "doctor_prescriptions",
    "doctor_orders",
    "audit_logs",
    "collections",
]

def migrate():
    print("🔌 Connecting to source (Render)...")
    src_engine = create_engine(SOURCE_URL, connect_args={"connect_timeout": 30})
    
    print("🔌 Connecting to destination (Supabase)...")
    dst_engine = create_engine(DEST_URL, connect_args={"connect_timeout": 30})

    # Test connections
    with src_engine.connect() as c:
        v = c.execute(text("SELECT version()")).scalar()
        print(f"✅ Source connected: {v[:50]}")

    with dst_engine.connect() as c:
        v = c.execute(text("SELECT version()")).scalar()
        print(f"✅ Destination connected: {v[:50]}")

    # Reflect source schema
    src_meta = MetaData()
    src_meta.reflect(bind=src_engine)

    # Create all tables in destination (from source schema)
    print("\n📐 Creating tables in Supabase...")
    dst_meta = MetaData()
    dst_meta.reflect(bind=dst_engine)

    # Use source metadata to create tables in destination
    src_meta_copy = MetaData()
    src_meta_copy.reflect(bind=src_engine)
    src_meta_copy.create_all(bind=dst_engine, checkfirst=True)
    print("✅ Tables created (or already exist)")

    # Migrate each table
    print("\n📦 Migrating data...\n")
    total_rows = 0

    # Get tables that actually exist in source
    existing_tables = set(src_meta.tables.keys())

    with src_engine.connect() as src_conn:
        with dst_engine.connect() as dst_conn:
            for table_name in TABLE_ORDER:
                if table_name not in existing_tables:
                    print(f"  ⚠️  Skipping '{table_name}' (not found in source)")
                    continue

                table = src_meta.tables[table_name]

                # Count rows
                count_result = src_conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                row_count = count_result.scalar()

                if row_count == 0:
                    print(f"  ⏭️  {table_name}: empty, skipped")
                    continue

                print(f"  📋 {table_name}: copying {row_count} rows...", end=" ", flush=True)

                # Clear destination table first (in reverse order to avoid FK issues)
                try:
                    dst_conn.execute(text(f"TRUNCATE TABLE {table_name} CASCADE"))
                    dst_conn.commit()
                except Exception as e:
                    dst_conn.rollback()
                    print(f"\n  ⚠️  Could not truncate {table_name}: {e}")

                # Fetch and insert in batches
                batch_size = 500
                offset = 0
                inserted = 0

                while True:
                    rows = src_conn.execute(
                        text(f"SELECT * FROM {table_name} LIMIT {batch_size} OFFSET {offset}")
                    ).fetchall()

                    if not rows:
                        break

                    col_names = list(src_meta.tables[table_name].columns.keys())
                    rows_as_dicts = [dict(zip(col_names, row)) for row in rows]

                    try:
                        dst_conn.execute(table.insert(), rows_as_dicts)
                        dst_conn.commit()
                        inserted += len(rows)
                        offset += batch_size
                    except Exception as e:
                        dst_conn.rollback()
                        print(f"\n  ❌ Error inserting into {table_name}: {e}")
                        break

                print(f"✅ {inserted}/{row_count} rows")
                total_rows += inserted

    # Fix sequences (auto-increment IDs) in Supabase
    print("\n🔧 Resetting sequences...")
    with dst_engine.connect() as dst_conn:
        for table_name in TABLE_ORDER:
            try:
                dst_conn.execute(text(f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table_name}', 'id'),
                        COALESCE((SELECT MAX(id) FROM {table_name}), 1)
                    )
                """))
                dst_conn.commit()
            except Exception:
                dst_conn.rollback()

    print(f"\n✅ Migration complete! {total_rows} total rows migrated to Supabase.")
    print("\n📋 Next step: Update your Render backend's DATABASE_URL env var to:")
    print(f"   postgresql://postgres:Bhumiar5400!@#@db.gwovavxknhcmjnqobsmp.supabase.co:5432/postgres")
    print("\n   Go to: Render → shreyansh-vollora-backend → Environment → Edit DATABASE_URL")

if __name__ == "__main__":
    migrate()
