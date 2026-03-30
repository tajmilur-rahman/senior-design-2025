# Spotfixes Intelligence
Enterprise Bug Triage and Severity Prediction Engine

## Overview

Spotfixes is a machine learning platform designed to automate the triage and prioritization of software vulnerabilities. The system analyzes bug reports and predicts severity levels while identifying duplicate issues across large repositories.

The platform is trained using more than 222,000 historical Mozilla Firefox bug records and provides near real-time predictions to assist engineering teams in prioritizing critical incidents.

Spotfixes integrates machine learning, natural language processing, and secure multi-tenant infrastructure to create a scalable bug triage intelligence system.

---

## Key Features

- Automated bug severity prediction (S1–S4 classification)
- Duplicate bug detection using semantic vector search
- Continuous machine learning retraining using human corrections
- Real-time performance telemetry
- Secure multi-tenant architecture
- Batch ingestion for large bug datasets
- Fast API-driven backend

---

## System Architecture

The platform consists of four major layers.

### Client Layer

Frontend interface for engineers to:

- Submit bug reports
- Override AI predictions
- Upload datasets
- Monitor model performance

### Application Layer

Backend services built with FastAPI manage:

- Prediction requests
- Model inference
- dataset ingestion
- telemetry aggregation

### Machine Learning Layer

Random Forest classifier processes bug report text using NLP vectorization.

Core ML functions:

- severity classification
- prediction confidence scoring
- confusion matrix evaluation
- retraining using human feedback

### Data Layer

Supabase PostgreSQL stores:

- bug reports
- prediction results
- correction feedback
- telemetry metrics
- company tenant data

Row-Level Security ensures strict tenant isolation.

---

## Retraining Intelligence Loop

The system continuously improves through human-in-the-loop corrections.

### 1 Manual Correction Capture

When engineers override AI predictions, the system records the correction as ground truth.

Impact:

- correction stored in telemetry table
- accuracy metrics update instantly
- model feedback dataset expands

### 2 Batch Dataset Ingestion

Large datasets can be uploaded using CSV or JSON files.

The system automatically:

- compares predicted severity vs actual severity
- generates confusion matrix metrics
- identifies model drift

### 3 Dynamic Performance Telemetry

Performance metrics are generated using real-time SQL aggregation.

Training dataset size is calculated as:

historical baseline dataset + live feedback corrections

This ensures accurate representation of model learning.

---

## Technology Stack

| Layer | Technology |
|------|------------|
| Backend | FastAPI (Python 3.10+) |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Identity + JWT |
| Machine Learning | Random Forest Classifier |
| NLP Processing | N-gram vectorization |
| Search Engine | Vector similarity search |
| Security | Row-Level Security (RLS) |
| API | REST architecture |

---

## Dataset

Training data originates from the Mozilla Firefox Bug Dataset.

Dataset characteristics:

- 222,000+ bug reports
- historical severity labels
- technical issue descriptions
- software component metadata

This dataset enables training a model capable of identifying severity patterns in technical bug language.

---

## Data Pipeline

### 1 Data Ingestion

Bug datasets are uploaded via the API endpoint:

```
POST /upload_and_train
```

### 2 Prediction Evaluation

The system compares:

```
predicted_severity
actual_severity
```

Results are stored for telemetry analysis.

### 3 Metrics Aggregation

Model performance metrics are retrieved using:

```
GET /get_ml_metrics
```

Metrics include:

- accuracy
- confusion matrix
- correction rate
- training volume

### 4 Timestamp Localization

All database timestamps are stored in UTC and automatically converted to local system time.

---

## Installation

### Clone Repository

```
git clone https://github.com/yourusername/spotfixes.git
cd spotfixes
```

### Create Virtual Environment

```
python -m venv venv
source venv/bin/activate
```

### Install Dependencies

```
pip install -r requirements.txt
```

### Run Backend Server

```
uvicorn main:app --reload
```

The API will start locally at:

```
http://localhost:8000
```

---

## API Endpoints

### Upload and Train Dataset

```
POST /upload_and_train
```

Uploads a dataset and evaluates prediction accuracy.

### Get Machine Learning Metrics

```
GET /get_ml_metrics
```

Returns system telemetry including accuracy and confusion matrix.

### Predict Bug Severity

```
POST /predict
```

Accepts a bug report and returns predicted severity level.

---

## Security Architecture

The platform implements enterprise-grade security mechanisms.

Security features include:

- Supabase authentication
- JWT access tokens
- Row-Level Security policies
- company-id partitioning for tenant isolation
- secure API access control

---

## Deployment

The platform is designed for cloud deployment.

Recommended infrastructure:

Backend:
- Docker container
- FastAPI server

Database:
- Supabase PostgreSQL

Frontend hosting options:
- Vercel
- Netlify

---

## Screenshots

Add screenshots of the following modules.

- Bug analysis dashboard
- Severity prediction interface
- Performance telemetry dashboard
- dataset upload module

Example structure:

```
/screenshots
dashboard.png
prediction.png
performance.png
```

---

## Project Milestones

December 2025 – March 2026

Completed:

- Random Forest severity prediction engine
- Supabase authentication integration
- Row-Level Security multi-tenant architecture
- automatic user provisioning
- telemetry performance dashboard

---

## Development Roadmap

Current phase: Deployment and Optimization

Active development tasks:

- Admin dashboard for organization filtering
- credential visibility toggle for improved UX
- mobile push notifications for S1 critical incidents
- improved duplicate bug vector search
- automated model retraining pipeline

---

## Future Improvements

Planned improvements include:

- Transformer-based NLP model
- LLM-assisted bug summarization
- automated retraining pipeline
- cross-repository duplicate detection
- distributed ML training

---

## License

This project is released under the MIT License.

---

## Author

Anunjin Batdelger  
Computer Science – Gannon University

Machine Learning, AI Systems, and Distributed Applications
