# Senior Design 2025: Bug Prioritization Based on Severity Analysis

## Overview
This project explores machine learning techniques to **predict and prioritize software bugs** in the Mozilla Firefox browser.  
With Firefox’s rapid 4‑week release cycle, developers face challenges in addressing all reported bugs. Our solution leverages historical bug reports, crash data, and resolution records to **predict severity scores** and help prioritize fixes efficiently.

## Data
We use bug and crash report data from Mozilla’s [BugBug project](https://github.com/mozilla/bugbug/blob/master/docs/data.md).  
The data is stored in a **PostgreSQL database**, which serves as the backend for training and evaluating our models.  
Each bug record includes severity, component, description, and resolution details.

## Features
- Severity prediction using ML models: **XGBoost, Random Forest, SVM, Neural Networks**
- Advanced approaches: **TopicMiner‑MTM, BERT, SBERT, RAG (Retrieval Augmented Generation)**
- Empirical analysis of bug lifespan and resolution time
- Streamlit app for interactive exploration

## Installation
Clone the repo:
```bash
git clone https://github.com/tajmilur-rahman/senior-design-2025.git
cd senior-design-2025
pip install -r requirements.txt

Roadmap
[x] Data collection and preprocessing
[x] Preliminary ML experiments
[ ] RAG‑based solution exploration
[ ] Model comparison and evaluation
[ ] Final presentation and documentation

##Usage
Set up your environment: Install dependencies from requirements.txt and configure your local environment variables in a .env file (e.g., database connection details).
Prepare the data: Ensure your PostgreSQL database is populated with bug data from Mozilla’s BugBug project.
Run experiments: Use the provided Python scripts to train and evaluate machine learning models on bug severity prediction.
Explore results: Launch the Streamlit app to interactively visualize bug data, severity predictions, and model comparisons.

Team
Senior Design 2025 Team Advisor: Dr. Tajmilur Rahman
