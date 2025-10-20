from bugbug import bugzilla, db
import psycopg2

DB_NAME = "bugbug_data"
DB_USER = "postgres"
DB_PASS = "2331"
DB_HOST = "localhost"
DB_PORT = "5432"

conn = psycopg2.connect(
    dbname=DB_NAME,
    user=DB_USER,
    password=DB_PASS,
    host=DB_HOST,
    port=DB_PORT
)
cursor = conn.cursor()

cursor.execute("""
    CREATE TABLE IF NOT EXISTS bugs (
        id SERIAL PRIMARY KEY,
        bug_id BIGINT UNIQUE
    );
""")
conn.commit()

# db.download(bugzilla.BUGS_DB)

for bug in bugzilla.get_bugs():
    bug_id = bug["id"]
    try:
        cursor.execute(
            "INSERT INTO bugs (bug_id) VALUES (%s) ON CONFLICT (bug_id) DO NOTHING;",
            (bug_id,)
        )
    except Exception as e:
        print(f"Failed to insert bug {bug_id}: {e}")

conn.commit()
cursor.close()
conn.close()

print("All bug IDs have been inserted into PostgreSQL.")
