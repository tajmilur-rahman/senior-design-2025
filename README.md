How to Run the Bug Priority System
Important: This project requires Python 3.11. Do not use Python 3.12 or 3.14, as the AI libraries (TensorFlow/Onnx) are not compatible yet.

1️⃣ Prerequisites
Node.js (for Frontend)

Python 3.11 (Ensure you check "Add to PATH" during installation)

2️⃣ Backend Setup
Open a terminal in the backend/ folder.

Create a Virtual Environment:

Bash
python -m venv .venv
(Mac/Linux: python3 -m venv .venv)

Activate it:

Windows: .venv\Scripts\activate

Mac/Linux: source .venv/bin/activate

Install Dependencies:

Bash
pip install fastapi uvicorn sqlalchemy pg8000 chromadb sentence-transformers scikit-learn joblib pandas numpy
(Note: We use pg8000 instead of psycopg2 to prevent Windows DLL errors).

Initialize the AI Models:

Make sure data.csv is inside the backend/ folder.

Run the training script (Creates the generic logic):

Bash
python train_model.py
Run the database builder (Creates the search engine):

Bash
python build_rag_db.py
3️⃣ Frontend Setup
Open a new terminal in the frontend/ folder.

Install packages:

Bash
npm install
4️⃣ Start the App
Terminal 1 (Backend):

Bash
cd backend
uvicorn main:app --reload
(Wait 15 seconds for "✅ Random Forest & Vectorizer Loaded" message).

Terminal 2 (Frontend):

Bash
cd frontend
npm run dev
Open Browser: Go to http://localhost:5173