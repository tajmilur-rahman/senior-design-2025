from database import supabase

FIREFOX_TABLE = "firefox_table"
FIREFOX_COMPANY_NAMES = {"firefox", "mozilla", "mozilla firefox"}


def is_firefox_company(company_name: str) -> bool:
    return company_name.strip().lower() in FIREFOX_COMPANY_NAMES


def company_table_name(company_id: int) -> str:
    return f"company_{company_id}_bugs"


def create_company_table(company_id: int) -> str:
    result = supabase.rpc("create_company_table", {"p_company_id": company_id}).execute()
    return result.data or company_table_name(company_id)


def seed_company_table(company_id: int, sample_size: int = 5000) -> int:
    result = supabase.rpc("seed_company_table", {
        "p_company_id":   company_id,
        "p_sample_size":  sample_size,
    }).execute()
    return result.data or 0


def drop_company_table(company_id: int):
    supabase.rpc("drop_company_table", {"p_company_id": company_id}).execute()
