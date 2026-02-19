from sqlalchemy import Column, Integer, String, JSON, ForeignKey, BigInteger, Text, Float
from database import Base

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)

class Batch(Base):
    """
    Stores history of uploads AND the model's accuracy at that point in time.
    """
    __tablename__ = "batches"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True)
    filename = Column(String)
    upload_time = Column(String)
    record_count = Column(Integer)
    accuracy = Column(Float, nullable=True)

    company_id = Column(Integer, ForeignKey("companies.id"))


class Bug(Base):
    __tablename__ = "bugs"
    id = Column(Integer, primary_key=True, index=True)
    bug_id = Column(BigInteger, unique=True, index=True)
    summary = Column(Text)
    component = Column(String)
    severity = Column(String)
    status = Column(String)

    # Links bug to a specific upload batch
    batch_id = Column(String, index=True, nullable=True)

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