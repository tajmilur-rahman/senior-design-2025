# backend/db_provision.py
"""
Company table lifecycle helpers.
Uses Supabase RPC (stored Postgres functions) instead of a direct DB
connection — avoids DNS issues with the raw PostgreSQL port.

Requires these functions to exist in Supabase (run once in SQL editor):
  - create_company_table(p_company_id INT) -> TEXT
  - seed_company_table(p_company_id INT, p_sample_size INT) -> INT
  - drop_company_table(p_company_id INT) -> VOID
"""
from database import supabase

FIREFOX_TABLE = "firefox_table"
FIREFOX_COMPANY_NAMES = {"firefox", "mozilla", "mozilla firefox"}


def is_firefox_company(company_name: str) -> bool:
    return company_name.strip().lower() in FIREFOX_COMPANY_NAMES


def company_table_name(company_id: int) -> str:
    return f"company_{company_id}_bugs"


def create_company_table(company_id: int) -> str:
    """
    Creates company_{id}_bugs via Supabase RPC.
    Returns the table name.
    """
    result = supabase.rpc("create_company_table", {"p_company_id": company_id}).execute()
    return result.data or company_table_name(company_id)


def seed_company_table(company_id: int, sample_size: int = 5000) -> int:
    """
    Seeds company_{id}_bugs with a random sample from firefox_table via RPC.
    Returns the number of rows inserted.
    """
    result = supabase.rpc("seed_company_table", {
        "p_company_id":   company_id,
        "p_sample_size":  sample_size,
    }).execute()
    return result.data or 0


def drop_company_table(company_id: int):
    """
    Drops company_{id}_bugs via RPC.
    Silently succeeds if the table does not exist.
    """
    supabase.rpc("drop_company_table", {"p_company_id": company_id}).execute()
