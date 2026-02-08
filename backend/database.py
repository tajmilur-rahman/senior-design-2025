# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import DB

# Construct URL from your config dictionary
#DATABASE_URL = f"postgresql+pg8000://{DB['user']}:{DB['password']}@{DB['host']}:{DB['port']}/{DB['dbname']}"
DATABASE_URL = "postgresql+pg8000://postgres:2331@localhost:5432/bugbug_data"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()