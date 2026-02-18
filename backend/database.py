from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from supabase import create_client, Client

# Project URL: Use your Project ID to form this
SUPABASE_URL = "https://ofthvbabxgzsjercdjmo.supabase.co"
# Anon Key: Copy the long string from your "anon public" box in the last screenshot
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mdGh2YmFieGd6c2plcmNkam1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzA1OTYsImV4cCI6MjA4NzAwNjU5Nn0.yjNcaOg6zpVpH33vAC0cHB77OfPCjH6w_qiN84RrW10" 

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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