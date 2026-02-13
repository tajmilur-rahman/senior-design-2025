from sqlalchemy import Column, Integer, String, JSON, ForeignKey, BigInteger, Text
from database import Base


class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)


class Bug(Base):
    __tablename__ = "bugs"

    # Change 'id' to 'bug_id' to match the database exactly
    bug_id = Column(Integer, primary_key=True, index=True) 
    summary = Column(String)
    component = Column(String)
    severity = Column(String)
    status = Column(String)
    company_id = Column(Integer, ForeignKey("companies.id"))
    data = Column(JSON)


class User(Base):
    __tablename__ = "users"
    username = Column(String, primary_key=True)
    password_hash = Column(String)
    role = Column(String)
    company_id = Column(Integer, ForeignKey("companies.id"))


class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    summary = Column(String)
    predicted_severity = Column(String)
    actual_severity = Column(String)
    company_id = Column(Integer, ForeignKey("companies.id"))