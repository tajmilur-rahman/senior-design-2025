from sqlalchemy import Column, Integer, String, JSON, ForeignKey, BigInteger
from database import Base

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)

class Bug(Base):
    __tablename__ = "bugs"
    id = Column(Integer, primary_key=True, index=True)
    # FIX: Changed Integer to BigInteger to handle timestamp-based IDs
    bug_id = Column(BigInteger, unique=True)
    data = Column(JSON)
    company_id = Column(Integer, ForeignKey("companies.id"))

class User(Base):
    __tablename__ = "users"
    username = Column(String, primary_key=True)
    password_hash = Column(String)
    role = Column(String)
    company_id = Column(Integer, ForeignKey("companies.id"))

# --- NEW: FEEDBACK TABLE ---
class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    summary = Column(String)
    predicted_severity = Column(String)
    actual_severity = Column(String) # The user's correction
    company_id = Column(Integer, ForeignKey("companies.id"))