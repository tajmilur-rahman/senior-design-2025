import json
import psycopg2
import pandas as pd
from bugbug import bugzilla, db

DB = {
    "dbname": "bugbug_data",
    "user": "postgres",
    "password": "1234",
    "host": "localhost",
    "port": "5432"
}

db.download(bugzilla.BUGS_DB)

bugs = list(bugzilla.get_bugs())
print(f"Loaded {len(bugs)} bugs from Bugbug")

print("\nAvailable fields:")

field_types = {}
for i, bug in enumerate(bugs):
    for key, value in bug.items():
        if key not in field_types:
            field_types[key] = type(value).__name__
    if i >= 99:
        break

print(f"\nTotal unique fields: {len(field_types)}\n")
for field in sorted(field_types.keys()):
    print(f"{field:25} -> {field_types[field]}")

print("\nSample bug data\n")
sample = bugs[0]
for k, v in list(sample.items())[:20]:
    print(f"{k:25}: {v}")

print("\nInserting into PostgreSQL")

conn = psycopg2.connect(**DB)
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS bugs (
    id SERIAL PRIMARY KEY,
    bug_id BIGINT UNIQUE,
    data JSONB
);
""")
conn.commit()

def sanitize_json(bug):
    text = json.dumps(bug, ensure_ascii=False)
    clean_text = text.replace("\u0000", "").replace("\x00", "")
    return clean_text.encode("utf-8", "ignore").decode("utf-8", "ignore")

count = 0
errors = 0

for bug in bugs:
    try:
        cur.execute("""
            INSERT INTO bugs (bug_id, data)
            VALUES (%s, %s)
            ON CONFLICT (bug_id) DO UPDATE SET data = EXCLUDED.data;
        """, (bug["id"], sanitize_json(bug)))
        count += 1

        if count % 1000 == 0:
            print(f"Inserted {count} bugs")
            conn.commit()

    except Exception as e:
        print(f"Skipping bug {bug.get('id')} due to error: {e}")
        conn.rollback()
        errors += 1

conn.commit()
cur.close()
conn.close()

print(f"\nImport done")
print(f"Inserted {count} bugs, skipped {errors} bad records.")
print("All bugs stored in JSONB format.")