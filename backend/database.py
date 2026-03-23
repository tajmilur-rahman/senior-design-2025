# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from supabase import create_client, Client
import httpx

# Project URL: Use your Project ID to form this
SUPABASE_URL = "https://ofthvbabxgzsjercdjmo.supabase.co"
# Anon Key: Copy the long string from your "anon public" box in the last screenshot
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mdGh2YmFieGd6c2plcmNkam1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQzMDU5NiwiZXhwIjoyMDg3MDA2NTk2fQ.k5_V15ObyBwdsjf_qO5x-n1yCOVNIiFHX1spilAA_Vg"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Force HTTP/1.1 on the PostgREST client.
# httpx defaults to HTTP/2 when the 'h2' package is installed, but Supabase's
# PostgREST closes HTTP/2 connections mid-stream, causing RemoteProtocolError.
supabase.postgrest.session = httpx.Client(
    http2=False,
    timeout=15.0,
    follow_redirects=True,
    headers=dict(supabase.postgrest.session.headers),
    base_url=str(supabase.postgrest.session.base_url),
)

# DATABASE_URL = "postgresql://postgres:anunjin123@127.0.0.1:5432/bugbug_data"
DATABASE_URL = "postgresql://postgres:GannonUniversity2026%24@db.ofthvbabxgzsjercdjmo.supabase.co:6543/postgres?sslmode=require"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# This is the shared 'Base' that models.py will import
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()