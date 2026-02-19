# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from supabase import create_client, Client

# Project URL and Key remain the same
SUPABASE_URL = "https://ofthvbabxgzsjercdjmo.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mdGh2YmFieGd6c2plcmNkam1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzA1OTYsImV4cCI6MjA4NzAwNjU5Nn0.yjNcaOg6zpVpH33vAC0cHB77OfPCjH6w_qiN84RrW10"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# CORRECTED: Use the pooled hostname and the long username (postgres.project-ref)
# This prevents the "No such host is known" DNS error.
DATABASE_URL = "postgresql://postgres.ofthvbabxgzsjercdjmo:GannonUniversity2026%24@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()