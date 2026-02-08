import mmap
import sys
import json
import psycopg2
import bcrypt
from psycopg2 import extras

# ==========================================
# 1. WINDOWS COMPATIBILITY PATCH
# ==========================================
if sys.platform == "win32":
    if not hasattr(mmap, "PROT_READ"):
        mmap.PROT_READ = mmap.ACCESS_READ
    _original_mmap = mmap.mmap


    def _mmap_windows_wrapper(*args, **kwargs):
        if "prot" in kwargs:
            if kwargs["prot"] == mmap.PROT_READ: kwargs["access"] = mmap.ACCESS_READ
            del kwargs["prot"]
        if "flags" in kwargs: del kwargs["flags"]
        return _original_mmap(*args, **kwargs)


    mmap.mmap = _mmap_windows_wrapper

from bugbug import bugzilla, db

# ==========================================
# 2. CONFIGURATION
# ==========================================
DB = {
    "dbname": "bugbug_data",
    "user": "postgres",
    "password": "2331",
    "host": "localhost",
    "port": "5432"
}

# The ID for the automatic account
DEFAULT_COMPANY_ID = 1


def get_connection():
    return psycopg2.connect(**DB)


def clean_obj(obj):
    if isinstance(obj, dict):
        return {k: clean_obj(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_obj(v) for v in obj]
    elif isinstance(obj, str):
        return obj.replace("\x00", "").encode("utf-8", "ignore").decode("utf-8", "ignore")
    else:
        return obj


def insert_batch(cursor, batch_data):
    query = """
            INSERT INTO bugs (bug_id, data, company_id)
            VALUES \
            %s
            ON CONFLICT (bug_id)
            DO UPDATE SET data = EXCLUDED.data;
            """
    extras.execute_values(
        cursor,
        query,
        batch_data,
        template="(%s, %s, %s)"
    )


def main():
    print("Downloading/Updating Bugbug DB...")
    db.download(bugzilla.BUGS_DB)

    conn = get_connection()
    cur = conn.cursor()

    print("--- SETUP: Ensuring Default Company & User Exist ---")

    # 1. Create Company
    cur.execute("""
                INSERT INTO companies (id, name)
                VALUES (%s, 'Default Corp')
                ON CONFLICT (id) DO NOTHING;
                """, (DEFAULT_COMPANY_ID,))

    # 2. Create Admin User (admin / admin)
    password = b"admin"
    hashed = bcrypt.hashpw(password, bcrypt.gensalt()).decode('utf-8')

    cur.execute("""
                INSERT INTO users (username, password_hash, role, company_id)
                VALUES ('admin', %s, 'admin', %s)
                ON CONFLICT (username) DO NOTHING;
                """, (hashed, DEFAULT_COMPANY_ID))

    conn.commit()
    print("✅ Created/Verified User: 'admin' with password: 'admin'")
    print("----------------------------------------------------")

    print("Streaming bugs and inserting into PostgreSQL (Optimized Mode)...")

    # OPTIMIZATION: Larger batch size for fewer round-trips
    BATCH_SIZE = 10000
    batch = []
    total_inserted = 0

    try:
        for bug in bugzilla.get_bugs():
            bug_id = bug.get('id')
            cleaned_bug = clean_obj(bug)
            json_wrapper = extras.Json(cleaned_bug)

            # Assign to the Default Company
            batch.append((bug_id, json_wrapper, DEFAULT_COMPANY_ID))

            if len(batch) >= BATCH_SIZE:
                insert_batch(cur, batch)
                total_inserted += len(batch)
                print(f"  -> Buffered/Stored {total_inserted} records...")
                batch = []

        if batch:
            insert_batch(cur, batch)
            total_inserted += len(batch)

        print("Committing transaction to disk...")
        conn.commit()

        print(f"\nSUCCESS: Import finished. Total records stored: {total_inserted}")

        print("Ensuring indexes exist...")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_bugs_bug_id ON bugs(bug_id);")
        conn.commit()

    except Exception as e:
        print(f"\nCRITICAL ERROR during import: {e}")
        conn.rollback()
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()