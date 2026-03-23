# backend/models.py
from sqlalchemy import Column, Integer, String, JSON, ForeignKey, Float, DateTime, Boolean
from database import Base
from datetime import datetime

class Company(Base):
    __tablename__ = "companies"
    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, unique=True)
    status      = Column(String, default="active")   # active | pending
    description = Column(String, default="")
    website     = Column(String, default="")
    created_at  = Column(DateTime, default=datetime.utcnow)
    has_own_model = Column(Boolean, default=False)

class User(Base):
    __tablename__ = "users"
    username      = Column(String, primary_key=True)
    password_hash = Column(String)
    role          = Column(String)           # user | admin | super_admin
    company_id    = Column(Integer, ForeignKey("companies.id"))
    status        = Column(String, default="active")  # active | pending | inactive

class Bug(Base):
    __tablename__ = "bugs"
    bug_id    = Column(Integer, primary_key=True, index=True)
    summary   = Column(String)
    component = Column(String)
    severity  = Column(String)
    status    = Column(String)
    company_id = Column(Integer, ForeignKey("companies.id"))
    data      = Column(JSON)

class TrainingBatch(Base):
    __tablename__ = "training_batches"
    id           = Column(Integer, primary_key=True, index=True, autoincrement=True)
    company_id   = Column(Integer, ForeignKey("companies.id"))
    filename     = Column(String)
    record_count = Column(Integer)
    accuracy     = Column(Float)
    upload_time  = Column(DateTime, default=datetime.utcnow)

class Feedback(Base):
    __tablename__ = "feedback"
    id                   = Column(Integer, primary_key=True, index=True, autoincrement=True)
    summary              = Column(String)
    predicted_severity   = Column(String)
    actual_severity      = Column(String, nullable=True)   # nullable: set on correction
    company_id           = Column(Integer, ForeignKey("companies.id"))
    confidence           = Column(Float)
    component            = Column(String)
    is_correction        = Column(Boolean, default=False)
    consent_global_model = Column(Boolean, default=True)
    created_at           = Column(DateTime, default=datetime.utcnow)