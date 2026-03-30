import re
import psycopg2
from database import supabase, DATABASE_URL

FIREFOX_TABLE = "firefox_table"
FIREFOX_COMPANY_NAMES = {"firefox", "mozilla", "mozilla firefox"}


def is_firefox_company(company_name: str) -> bool:
    return company_name.strip().lower() in FIREFOX_COMPANY_NAMES


def slugify_company_name(name: str) -> str:
    """Convert a company name into a safe PostgreSQL identifier segment."""
    slug = name.strip().lower()
    slug = re.sub(r'[^a-z0-9]+', '_', slug)
    slug = slug.strip('_')
    slug = re.sub(r'_+', '_', slug)
    slug = slug[:45]          # leave room for '_bugs' suffix (total ≤ 50)
    return slug or "company"


def company_table_name(company_name: str) -> str:
    """Return the expected table name for a company (e.g. 'acme_corp_bugs')."""
    return f"{slugify_company_name(company_name)}_bugs"


def create_company_table(company_id: int, company_name: str) -> str:
    """
    Create a company-specific bugs table named after the company.
    Returns the actual table name created (may add numeric suffix for uniqueness).
    Uses psycopg2 directly so we control the table name completely.
    """
    base_name = company_table_name(company_name)

    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()
    try:
        # Resolve a unique table name
        table_name = base_name
        counter    = 2
        while True:
            cur.execute("SELECT to_regclass(%s)", (f"public.{table_name}",))
            exists = cur.fetchone()[0]
            if exists is None:
                break
            # If this table is already assigned to THIS company, reuse it
            cur.execute(
                "SELECT id FROM companies WHERE data_table = %s AND id = %s",
                (table_name, company_id),
            )
            if cur.fetchone():
                return table_name
            table_name = f"{base_name}_{counter}"
            counter   += 1

        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS {table_name} (
                id         SERIAL PRIMARY KEY,
                bug_id     INTEGER,
                summary    TEXT,
                component  TEXT,
                severity   TEXT,
                status     TEXT,
                company_id INTEGER DEFAULT {company_id},
                data       JSONB,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """)
        # Enable RLS — blocks direct anon/authenticated access.
        # The backend always connects as the postgres superuser (psycopg2) or
        # uses the service_role key (Supabase REST), both of which bypass RLS
        # automatically, so no additional policy is needed for backend access.
        cur.execute(f'ALTER TABLE "{table_name}" ENABLE ROW LEVEL SECURITY')
        conn.commit()
        return table_name
    finally:
        cur.close()
        conn.close()


def seed_company_table(company_id: int, sample_size: int = 5000) -> int:
    """Seed via Supabase RPC (used by reset endpoint)."""
    result = supabase.rpc("seed_company_table", {
        "p_company_id":  company_id,
        "p_sample_size": sample_size,
    }).execute()
    return result.data or 0


def drop_company_table(table_name: str):
    """
    Drop a company-specific table by its actual table name.
    Refuses to drop core system tables.
    """
    protected = {"bugs", "firefox_table", "firefox_table_backup",
                 "companies", "users", "feedback",
                 "training_batches", "resolution_knowledge"}
    if not table_name or table_name in protected:
        return
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur  = conn.cursor()
        # Safe: table_name validated above; use identifier quoting
        cur.execute(f'DROP TABLE IF EXISTS "{table_name}"')
        conn.commit()
        cur.close()
        conn.close()
        print(f"[db_provision] dropped table: {table_name}")
    except Exception as e:
        print(f"[db_provision] drop_company_table({table_name}): {e}")
