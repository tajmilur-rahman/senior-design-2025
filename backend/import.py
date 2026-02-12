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
        mmap.PROT_READ = 0x01  # Windows fallback
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


# [FIX] MAPPING LOGIC: Converts Bugzilla formats to S1-S4
def map_severity(bug):
    # 1. Try to map based on the textual 'severity' field first (blocker, critical, etc.)
    sev_text = str(bug.get('severity', '')).lower()

    if 'blocker' in sev_text or 'critical' in sev_text: return 'S1'
    if 'major' in sev_text: return 'S2'
    if 'normal' in sev_text: return 'S3'
    if 'minor' in sev_text or 'trivial' in sev_text: return 'S4'

    # 2. Fallback: Map based on 'priority' (P1, P2...) if severity is ambiguous
    prio = str(bug.get('priority', '')).upper()
    if 'P1' in prio: return 'S1'
    if 'P2' in prio: return 'S2'
    if 'P3' in prio: return 'S3'
    if 'P4' in prio or 'P5' in prio: return 'S4'

    return 'S3'  # Default if nothing matches


def main():
    print("Downloading/Updating Bugbug DB...")
    db.download(bugzilla.BUGS_DB)

    conn = get_connection()
    cur = conn.cursor()

    print("--- SETUP: Resolving Target Company ---")
    cur.execute("SELECT company_id FROM users WHERE username = 'admin'")
    existing_user = cur.fetchone()
    TARGET_COMPANY_ID = existing_user[0] if existing_user else 1

    if not existing_user:
        print("⚠️ Creating default admin user...")
        cur.execute("INSERT INTO companies (id, name) VALUES (%s, 'Default Corp') ON CONFLICT (id) DO NOTHING",
                    (TARGET_COMPANY_ID,))
        password = b"admin"
        hashed = bcrypt.hashpw(password, bcrypt.gensalt()).decode('utf-8')
        cur.execute(
            "INSERT INTO users (username, password_hash, role, company_id) VALUES ('admin', %s, 'admin', %s) ON CONFLICT (username) DO NOTHING",
            (hashed, TARGET_COMPANY_ID))

    conn.commit()

    print("Streaming bugs and inserting into PostgreSQL...")
    BATCH_SIZE = 5000
    batch = []
    total_inserted = 0

    try:
        for bug in bugzilla.get_bugs():
            bug_id = bug.get('id')
            cleaned_bug = clean_obj(bug)

            # [FIX] Use the mapper to get S1/S2/S3
            s_code = map_severity(cleaned_bug)

            # Inject the mapped severity back into the JSON so the UI sees it too
            cleaned_bug['severity'] = s_code

            json_wrapper = extras.Json(cleaned_bug)

            summary = cleaned_bug.get('summary', '')
            component = cleaned_bug.get('product', '')
            status = cleaned_bug.get('status', '')

            # Insert with the mapped S-Code
            batch.append((bug_id, summary, component, s_code, status, json_wrapper, TARGET_COMPANY_ID))

            if len(batch) >= BATCH_SIZE:
                insert_batch(cur, batch)
                total_inserted += len(batch)
                print(f"  -> Buffered/Stored {total_inserted} records...", end='\r')
                batch = []

        if batch:
            insert_batch(cur, batch)
            total_inserted += len(batch)

        conn.commit()
        print(f"\nSUCCESS: Import finished. Total records stored: {total_inserted}")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_bugs_bug_id ON bugs(bug_id);")
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
            VALUES \
            %s
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