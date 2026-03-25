from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from supabase import create_client, Client
import httpx

SUPABASE_URL = "https://ofthvbabxgzsjercdjmo.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mdGh2YmFieGd6c2plcmNkam1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQzMDU5NiwiZXhwIjoyMDg3MDA2NTk2fQ.k5_V15ObyBwdsjf_qO5x-n1yCOVNIiFHX1spilAA_Vg"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

supabase.postgrest.session = httpx.Client(
    http2=False,
    timeout=15.0,
    follow_redirects=True,
    headers=dict(supabase.postgrest.session.headers),
    base_url=str(supabase.postgrest.session.base_url),
)

DATABASE_URL = "postgresql://postgres:GannonUniversity2026%24@db.ofthvbabxgzsjercdjmo.supabase.co:6543/postgres?sslmode=require"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
