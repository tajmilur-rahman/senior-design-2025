# Bug Priority & Analysis System
**Senior Design Project - AI-Powered Bug Tracking**

This system integrates a **Random Forest** classifier for real-time severity prediction and a **ChromaDB-powered RAG** (Retrieval-Augmented Generation) engine to detect duplicate bugs within the database.

---

## Critical Version Requirements
* **Python 3.11 ONLY**: Do not use Python 3.12 or higher. Many core AI libraries used here (such as `bugbug` and older `TensorFlow` dependencies) are not yet compatible with newer Python versions.
* **Node.js**: Required for the React frontend.
* **PostgreSQL**: A local instance must be running with a database named `bugbug_data`.

---

## 1️⃣ Backend Setup
The backend serves as the API and houses the machine learning logic.

1.  **Navigate to the backend folder**:
    ```bash
    cd backend
    ```
2.  **Create and Activate a Virtual Environment**:
    * **Windows**: 
        ```bash
        python -m venv .venv
        .venv\Scripts\activate
        ```
    * **Mac/Linux**: 
        ```bash
        python3 -m venv .venv
        source .venv/bin/activate
        ```
3.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

---

## 2️⃣ Machine Learning Pipeline (The "Brain")
You must generate the model artifacts before starting the server for the first time.



1.  **Generate Dataset**:
    * Navigate to the `Random Forest ML/` folder.
    * Run `python make_data.py` to download and prepare the Hugging Face dataset.
2.  **Train the Model**:
    * Run `python Train_Universal.py`.
    * This will create `rf_model.pkl` and `tfidf_vectorizer.pkl`.
3.  **Automatic Deployment**:
    * The scripts are configured to save these artifacts directly into the `backend/` directory where the API expects it.

---

## 3️⃣ Database & Search Initialization
1.  **Import Bugzilla Data**:
    * Inside the `backend/` folder, run `python import.py`.
    * This script maps raw Bugzilla data to our internal S1–S4 severity scale.
2.  **Build Vector Memory**:
    * Run `python build_rag_db.py` to initialize the ChromaDB instance.
    * This creates the `rag_db` folder used for finding similar past bugs.

---

## 4️⃣ Frontend Setup
1.  **Navigate to the frontend folder**:
    ```bash
    cd frontend
    ```
2.  **Install Packages**:
    ```bash
    npm install
    ```

---

## Running the Application

### **Terminal 1: Backend (FastAPI)**
```bash
cd backend
uvicorn main:app --reload
### **Terminal 2: Frontend (React)**
```bash
cd frontend
npm run dev
