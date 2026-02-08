import pandas as pd
import chromadb
from sentence_transformers import SentenceTransformer
import os

print("--- STARTING DATABASE BUILD ---")

# 1. Load Data
if not os.path.exists("data.csv"):
    print("❌ Error: 'data.csv' not found in backend folder.")
    exit()

try:
    df = pd.read_csv("data.csv")
    print(f"✅ CSV Loaded. Found {len(df)} rows.")
    print("   Raw Columns:", df.columns.tolist())
except Exception as e:
    print(f"❌ Error reading CSV: {e}")
    exit()

# 2. Normalize Columns (Fix Capitalization issues)
# This turns "Summary", "SUMMARY", " TiTlE " into "summary", "title"
df.columns = [c.lower().strip() for c in df.columns]

# 3. Auto-Detect the "Summary" Column
target_col = None
possible_names = ['summary', 'title', 'short description', 'short_description', 'description']

for name in possible_names:
    if name in df.columns:
        target_col = name
        break

if not target_col:
    print("❌ CRITICAL ERROR: Could not find a text column!")
    print(f"   We looked for: {possible_names}")
    print(f"   We found: {df.columns.tolist()}")
    print("   -> Please rename the main text column in data.csv to 'summary'.")
    exit()

print(f"✅ Using column '{target_col}' for AI analysis.")

# 4. Prepare Data for AI
# We convert everything to string to prevent crashes on empty cells
docs = df[target_col].astype(str).tolist()
ids = [str(i) for i in range(len(df))]

# Try to find metadata columns (optional)
sev_col = 'severity' if 'severity' in df.columns else target_col # fallback
status_col = 'status' if 'status' in df.columns else target_col # fallback

metadatas = []
for index, row in df.iterrows():
    metadatas.append({
        "severity": str(row[sev_col]),
        "status": str(row[status_col])
    })

# 5. Initialize AI Engine
print("⏳ Loading AI Model (this happens once)...")
client = chromadb.PersistentClient(path="./rag_db")

# Delete old DB if exists to avoid duplicates
try:
    client.delete_collection("bug_reports")
except:
    pass

collection = client.get_or_create_collection(name="bug_reports")
model = SentenceTransformer('all-MiniLM-L6-v2')

# 6. Generate Embeddings
print("⏳ Generating Embeddings (May take 30-60 seconds)...")
embeddings = model.encode(docs).tolist()

print("⏳ Saving to Vector Database...")
# Add in batches to be safe
batch_size = 500
total = len(docs)

for i in range(0, total, batch_size):
    end = min(i + batch_size, total)
    collection.add(
        documents=docs[i:end],
        embeddings=embeddings[i:end],
        metadatas=metadatas[i:end],
        ids=ids[i:end]
    )
    print(f"   Processed {end}/{total} records...")

print("✅ Vector Database Built Successfully!")