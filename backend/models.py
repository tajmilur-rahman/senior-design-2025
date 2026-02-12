from sqlalchemy import Column, Integer, String, JSON, ForeignKey, BigInteger, Text
from database import Base


class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)


class Bug(Base):
    __tablename__ = "bugs"
    id = Column(Integer, primary_key=True, index=True)
    # Matches your DB Schema
    bug_id = Column(BigInteger, unique=True, index=True)

    # [FIX] Added these columns so we can fetch them without loading the huge 'data' JSON
    summary = Column(Text)
    component = Column(String)
    severity = Column(String)
    status = Column(String)

    data = Column(JSON)
    company_id = Column(Integer, ForeignKey("companies.id"))


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