from sqlalchemy import Column, Integer, String, JSON
from database import Base

class Bug(Base):
    __tablename__ = "bugs"
    id = Column(Integer, primary_key=True, index=True)
    bug_id = Column(Integer, unique=True) # The original Bugzilla ID
    data = Column(JSON) # Your existing JSON blob

class User(Base):
    __tablename__ = "users"
    username = Column(String, primary_key=True)
    password_hash = Column(String)
    role = Column(String)