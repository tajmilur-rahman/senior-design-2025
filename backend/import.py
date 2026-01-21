import json
import psycopg2
from psycopg2 import extras
from bugbug import bugzilla, db

DB = {
    "dbname": "bugbug_data",
    "user": "postgres",
    "password": "2331",
    "host": "localhost",
    "port": "5432"
}

def get_connection():
    return psycopg2.connect(**DB)

def sanitize_json(bug):
    """
    Sanitizes the bug dictionary to valid JSON string, removing Null bytes
    that cause PostgreSQL errors.
    """
    try:
        text = json.dumps(bug, ensure_ascii=False)
        clean_text = text.replace("\u0000", "").replace("\x00", "")
        return clean_text
    except Exception as e:
        print(f"Sanitization failed: {e}")
        return "{}"


def main():
    print("Downloading/Updating Bugbug DB...")
    db.download(bugzilla.BUGS_DB)

    conn = get_connection()
    cur = conn.cursor()

    print("Setting up database schema...")
    cur.execute("""
                CREATE TABLE IF NOT EXISTS bugs
                (
                    id     SERIAL PRIMARY KEY,
                    bug_id BIGINT UNIQUE,
                    data   JSONB
                );
                """)
    conn.commit()

    print("Streaming bugs and inserting into PostgreSQL...")

    # CONFIG: Batch size for bulk inserts (higher = faster, but more RAM)
    BATCH_SIZE = 2000

    batch = []
    total_inserted = 0

    # ITERATE directly (Do not use list() to save RAM)
    for bug in bugzilla.get_bugs():
        # Prepare the tuple: (bug_id, json_data)
        bug_id = bug.get('id')
        clean_data = sanitize_json(bug)

        batch.append((bug_id, clean_data))

        # When batch is full, execute bulk insert
        if len(batch) >= BATCH_SIZE:
            insert_batch(cur, batch)
            conn.commit()
            total_inserted += len(batch)
            print(f"Stored {total_inserted} records...")
            batch = []  # Reset batch

    # Insert any remaining records in the final partial batch
    if batch:
        insert_batch(cur, batch)
        conn.commit()
        total_inserted += len(batch)

    print(f"\nSUCCESS: Import finished. Total records stored: {total_inserted}")

    # Create an index to make training queries faster later
    print("Creating index on bug_id for faster lookups...")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_bugs_bug_id ON bugs(bug_id);")
    conn.commit()

    cur.close()
    conn.close()


def insert_batch(cursor, batch_data):
    """
    Uses execute_values for high-speed bulk insertion.
    Handles conflicts by updating the data if bug_id exists.
    """
    query = """
            INSERT INTO bugs (bug_id, data)
            VALUES \
            %s
        ON CONFLICT (bug_id)
            DO UPDATE SET data = EXCLUDED.data; \
            """
    extras.execute_values(
        cursor,
        query,
        batch_data,
        template="(%s, %s)"
    )


if __name__ == "__main__":
    main()