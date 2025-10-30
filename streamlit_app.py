import streamlit as st
import json
import psycopg2
import pandas as pd
from bugbug import bugzilla, db

st.set_page_config(
    page_title="BugBug PostgreSQL Loader",
    page_icon="🪲",
    layout="wide"
)

DB = {
    "dbname": "bugbug_data",
    "user": "postgres",
    "password": "1234",
    "host": "localhost",
    "port": "5432"
}

def connect_db():
    return psycopg2.connect(**DB)


def sanitize_json(bug):
    text = json.dumps(bug, ensure_ascii=False)
    clean_text = text.replace("\u0000", "").replace("\x00", "")
    return clean_text.encode("utf-8", "ignore").decode("utf-8", "ignore")

st.sidebar.title("Mozilla Bug Data Importer")
page = st.sidebar.radio("Navigate", ["Overview", "Data Fields", "Database Import"])

if page == "Overview":
    st.title("🪲 BugBug → PostgreSQL Data Loader")
    st.markdown("""
    This interface downloads bug data from **Mozilla Bugzilla** using the `bugbug` library  
    and stores it into **PostgreSQL** in **JSONB format**.

    Each record contains:
    - `bug_id`: unique ID of the bug  
    - `data`: full JSON bug object (nested info: description, severity, component, etc.)
    """)
    st.info("Use the sidebar to preview available fields or insert bugs into the database.")

elif page == "Data Fields":
    st.title("🔍 Explore Available Bug Fields")
    if st.button("Load Sample from BugBug"):
        with st.spinner("Downloading BugBug dataset..."):
            db.download(bugzilla.BUGS_DB)
            bugs = list(bugzilla.get_bugs())
        st.success(f"Loaded {len(bugs)} bugs")

        field_types = {}
        for i, bug in enumerate(bugs):
            for key, value in bug.items():
                if key not in field_types:
                    field_types[key] = type(value).__name__
            if i >= 99:
                break

        field_df = pd.DataFrame(list(field_types.items()), columns=["Field Name", "Type"])
        st.dataframe(field_df, use_container_width=True)

        st.subheader("Sample Bug Data")
        st.json(bugs[0])

elif page == "Database Import":
    st.title("💾 Insert Bugs into PostgreSQL")

    st.markdown("Creates table **`bugs`** with columns `(id, bug_id, data)` using JSONB for full bug storage.")
    if st.button("Create Table"):
        try:
            with connect_db() as conn:
                cur = conn.cursor()
                cur.execute("""
                            CREATE TABLE IF NOT EXISTS bugs
                            (
                                id     SERIAL PRIMARY KEY,
                                bug_id BIGINT UNIQUE,
                                data   JSONB
                            );
                            """)
                conn.commit()
            st.success("✅ Table 'bugs' verified or created successfully.")
        except Exception as e:
            st.error(f"Error creating table: {e}")

    if st.button("Download + Insert Bugs"):
        with st.spinner("Downloading and inserting bug data... (may take several minutes)"):
            db.download(bugzilla.BUGS_DB)
            bugs = list(bugzilla.get_bugs())
            conn = connect_db()
            cur = conn.cursor()
            count, errors = 0, 0

            progress = st.progress(0, text="Inserting bugs.")
            for i, bug in enumerate(bugs):
                try:
                    cur.execute("""
                                INSERT INTO bugs (bug_id, data)
                                VALUES (%s, %s)
                                ON CONFLICT (bug_id) DO UPDATE SET data = EXCLUDED.data;
                                """, (bug["id"], sanitize_json(bug)))
                    count += 1
                    if count % 500 == 0:
                        conn.commit()
                    if i % 1000 == 0:
                        progress.progress(min(1.0, i / len(bugs)))
                except Exception:
                    conn.rollback()
                    errors += 1

            conn.commit()
            cur.close()
            conn.close()
            progress.progress(1.0)
            st.success(f"✅ Import done — Inserted {count} bugs, skipped {errors} bad records.")

    if st.button("View Sample from DB"):
        try:
            with connect_db() as conn:
                df = pd.read_sql("SELECT bug_id, data->>'summary' AS summary FROM bugs LIMIT 10;", conn)
            st.dataframe(df, use_container_width=True)
        except Exception as e:
            st.error(f"Error reading database: {e}")
