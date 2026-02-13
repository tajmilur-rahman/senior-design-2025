import mmap
import sys
import json
import psycopg2
import bcrypt
import time
from psycopg2 import extras

# ==========================================
# 1. WINDOWS COMPATIBILITY PATCH
# ==========================================
if sys.platform == "win32":
    if not hasattr(mmap, "PROT_READ"):
        mmap.PROT_READ = 0x01
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
    "password": "anunjin123",
    "host": "127.0.0.1",
    "port": "5432"
}

def get_connection():
    return psycopg2.connect(**DB)

def clean_obj(obj):
    if isinstance(obj, dict): return {k: clean_obj(v) for k, v in obj.items()}
    if isinstance(obj, list): return [clean_obj(v) for v in obj]
    if isinstance(obj, str): return obj.replace("\x00", "").encode("utf-8", "ignore").decode("utf-8")
    return obj

def map_severity(bug):
    sev_text = str(bug.get('severity', '')).lower()
    if any(x in sev_text for x in ['blocker', 'critical']): return 'S1'
    if 'major' in sev_text: return 'S2'
    if 'normal' in sev_text: return 'S3'
    if any(x in sev_text for x in ['minor', 'trivial']): return 'S4'
    
    prio = str(bug.get('priority', '')).upper()
    if 'P1' in prio: return 'S1'
    if 'P2' in prio: return 'S2'
    if 'P3' in prio: return 'S3'
    if 'P4' in prio or 'P5' in prio: return 'S4'
    return 'S3'

def main():
    print("Downloading/Updating Bugbug DB...")
    db.download(bugzilla.BUGS_DB)

    conn = get_connection()
    cur = conn.cursor()

    # --- THE FORCED FIX: Ensure the table is PERFECT before starting ---
    print("--- MAINTENANCE: Syncing Table Schema ---")
    cur.execute("DROP TABLE IF EXISTS bugs CASCADE;")
    cur.execute("""
        CREATE TABLE bugs (
            bug_id INTEGER PRIMARY KEY,
            summary TEXT,
            component TEXT,
            severity TEXT,
            status TEXT,
            company_id INTEGER,
            data JSONB
        );
    """)
    conn.commit()

    # --- DYNAMIC TARGET LOGIC ---
    print("--- SETUP: Resolving Target Company ---")
    
    # Try to find the MOST RECENT user registered in the system
    # We use username here because 'id' was causing issues earlier
    cur.execute("SELECT company_id, username FROM users ORDER BY username DESC LIMIT 1")
    user_row = cur.fetchone()

    if user_row:
        TARGET_COMPANY_ID = user_row[0]
        print(f"✅ Found existing user '{user_row[1]}'. Importing for Company ID: {TARGET_COMPANY_ID}")
    else:
        print("⚠️ No users found. Initializing default admin and company...")
        TARGET_COMPANY_ID = int(time.time())
        
        cur.execute("INSERT INTO companies (id, name) VALUES (%s, 'Default Corporation') ON CONFLICT DO NOTHING", (TARGET_COMPANY_ID,))
        
        hashed_password = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode('utf-8')
        cur.execute(
            "INSERT INTO users (username, password_hash, role, company_id) VALUES ('admin', %s, 'admin', %s) ON CONFLICT DO NOTHING",
            (hashed_password, TARGET_COMPANY_ID)
        )
        print(f"✅ Created admin/admin123 with Company ID: {TARGET_COMPANY_ID}")

    conn.commit()

    print(f"Streaming bugs and inserting into PostgreSQL for Company {TARGET_COMPANY_ID}...")
    BATCH_SIZE = 5000
    batch = []
    total_inserted = 0

    try:
        for bug in bugzilla.get_bugs():
            bug_id = bug.get('id')
            cleaned_bug = clean_obj(bug)
            s_code = map_severity(cleaned_bug)
            cleaned_bug['severity'] = s_code
            
            json_wrapper = extras.Json(cleaned_bug)
            summary = cleaned_bug.get('summary', '')
            component = cleaned_bug.get('product', '')
            status = cleaned_bug.get('status', '')

            batch.append((bug_id, summary, component, s_code, status, json_wrapper, TARGET_COMPANY_ID))

            if len(batch) >= BATCH_SIZE:
                insert_batch(cur, batch)
                total_inserted += len(batch)
                print(f"  -> Imported {total_inserted} bugs...", end='\r')
                batch = []

        if batch:
            insert_batch(cur, batch)
            total_inserted += len(batch)

        conn.commit()
        print(f"\nSUCCESS: Import finished. {total_inserted} records linked to ID {TARGET_COMPANY_ID}")
        
        # Performance tuning
        print("Finalizing indexes...")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_bugs_bug_id ON bugs(bug_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_bugs_company_id ON bugs(company_id);")
        conn.commit()

    except Exception as e:
        print(f"\nCRITICAL ERROR: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

def insert_batch(cursor, batch_data):
    query = """
            INSERT INTO bugs (bug_id, summary, component, severity, status, data, company_id)
            VALUES %s
            ON CONFLICT (bug_id)
            DO UPDATE SET
            summary = EXCLUDED.summary,
            component = EXCLUDED.component,
            severity = EXCLUDED.severity,
            status = EXCLUDED.status,
            data = EXCLUDED.data,
            company_id = EXCLUDED.company_id;
            """
    extras.execute_values(cursor, query, batch_data, template="(%s, %s, %s, %s, %s, %s, %s)")

if __name__ == "__main__":
    main()