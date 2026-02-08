import sys
import json
import psycopg2
import bcrypt
import csv
import os
from psycopg2 import extras

# ==========================================
# CONFIGURATION
# ==========================================
CSV_FILENAME = "../data.csv"  # <--- Path relative to backend directory
DB = {
    "dbname": "bugbug_data",
    "user": "postgres",
    "password": "1234",
    "host": "localhost",
    "port": "5432"
}

DEFAULT_COMPANY_ID = 1

# ==========================================
# HELPER FUNCTIONS
# ==========================================
def get_connection():
    return psycopg2.connect(**DB)

def insert_batch(cursor, batch_data):
    query = """
            INSERT INTO bugs (bug_id, data, company_id)
            VALUES %s
            ON CONFLICT (bug_id)
            DO UPDATE SET data = EXCLUDED.data;
            """
    extras.execute_values(
        cursor,
        query,
        batch_data,
        template="(%s, %s, %s)"
    )

def get_bugs_from_csv(filename):
    """
    Reads the CSV file line by line and converts it to the format
    our database expects (Dictionary).
    """
    if not os.path.exists(filename):
        print(f"❌ ERROR: File '{filename}' not found. Please download the CSV first.")
        sys.exit(1)

    print(f"Reading from {filename}...")
    
    with open(filename, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            # We construct a dictionary that looks like the original Bugbug object
            # Adjust these keys based on your actual CSV headers!
            bug_dict = {
                "id": int(row.get("id", 0)),
                "summary": row.get("description", row.get("summary", "")),
                "status": row.get("status", "UNKNOWN"),
                "severity": row.get("severity", "min"),
                "creation_time": row.get("date", row.get("creation_time", ""))
            }
            
            # Only yield if it has a valid ID
            if bug_dict["id"] != 0:
                yield bug_dict

# ==========================================
# MAIN EXECUTION
# ==========================================
def main():
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
    print("✅ Created/Verified User: 'admin'")

    print("----------------------------------------------------")
    print(f"Streaming bugs from '{CSV_FILENAME}' into PostgreSQL...")

    BATCH_SIZE = 5000
    batch = []
    total_inserted = 0

    try:
        # Loop through CSV instead of bugbug.get_bugs()
        for bug in get_bugs_from_csv(CSV_FILENAME):
            
            bug_id = bug['id']
            
            # Wrap the dict in Json for PostgreSQL JSONB column
            json_wrapper = extras.Json(bug)

            batch.append((bug_id, json_wrapper, DEFAULT_COMPANY_ID))

            if len(batch) >= BATCH_SIZE:
                insert_batch(cur, batch)
                total_inserted += len(batch)
                print(f"  -> Buffered/Stored {total_inserted} records...")
                batch = []

        # Insert remaining
        if batch:
            insert_batch(cur, batch)
            total_inserted += len(batch)

        print("Committing transaction to disk...")
        conn.commit()

        print(f"\nSUCCESS: Import finished. Total records stored: {total_inserted}")

        # Create Index for speed
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