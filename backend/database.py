import os
import time
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger("database")

# Use DATABASE_URL env variable in production (Neon PostgreSQL)
# Falls back to SQLite for local development
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./shreyansh_vollora.db")

# Neon/Render provide postgres:// URLs but SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs check_same_thread=False; PostgreSQL does not
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

# For Neon (and any serverless Postgres), use a pool that tolerates
# cold starts / auto-suspend: pre_ping checks the connection is alive
# before using it, recycling stale connections automatically.
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,       # detect & drop dead connections automatically
    pool_recycle=300,         # recycle connections every 5 min (Neon suspends after 5 min)
    pool_size=5,
    max_overflow=2,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def wait_for_db(retries: int = 10, delay: float = 3.0):
    """Retry connecting to the database on startup.

    Neon free tier auto-suspends and takes up to ~10 seconds to wake.
    Without retries, the app crashes immediately on a cold Neon start.
    """
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("✅ Database connection established.")
            return
        except Exception as e:
            logger.warning(
                f"⏳ DB not ready (attempt {attempt}/{retries}): {e}. "
                f"Retrying in {delay}s…"
            )
            time.sleep(delay)
    raise RuntimeError(
        "❌ Could not connect to the database after multiple retries. "
        "Check DATABASE_URL and Neon project status."
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
