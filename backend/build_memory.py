import pandas as pd
import chromadb
from sentence_transformers import SentenceTransformer
import os
import shutil

# --- CONFIG ---
# We look for the CSV in the current folder OR the folder above
POSSIBLE_PATHS = [
    "data.csv",                   # If inside backend
    "../Random Forest ML/data.csv", # If inside ML folder
    "../data.csv"
]

DB_PATH = "./rag_db"

def build_memory():
    print("🧠 Initializing Memory Builder...")

    # 1. LOCATE THE DATA
    csv_path = None
    for path in POSSIBLE_PATHS:
        if os.path.exists(path):
            csv_path = path
            print(f"✅ Found data at: {path}")
            break
    
    if not csv_path:
        print("❌ ERROR: Could not find 'data.csv'.")
        print("   -> Please check if data.csv exists in 'backend' or 'Random Forest ML'.")
        return

    # 2. LOAD DATA
    print("📂 Reading CSV...")
    try:
        # Load up to 20,000 rows for the demo (Change to None for all rows)
        df = pd.read_csv(csv_path, nrows=20000)
        print(f"   -> Raw Rows Loaded: {len(df)}")
        
        # Normalize columns (lowercase + strip spaces)
        df.columns = [c.lower().strip() for c in df.columns]
        
        # SMART COLUMN DETECTION
        target_col = None
        possible_names = ['summary', 'short_desc', 'short description', 'description', 'title']
        
        for name in possible_names:
            if name in df.columns:
                target_col = name
                break
        
        if not target_col:
            print(f"❌ ERROR: Could not find a text column! Found: {df.columns.tolist()}")
            return
            
        print(f"   -> Using column '{target_col}' for bug descriptions.")
        
        # Prepare Data
        # Ensure text is string and fill NaNs
        df[target_col] = df[target_col].fillna("").astype(str)
        
        # Handle metadata (Status)
        status_col = 'status' if 'status' in df.columns else None

    except Exception as e:
        print(f"❌ CSV Error: {e}")
        return

    # 3. SETUP DATABASE (Clean Slate)
    print("⚙️ Setting up Vector Database...")
    
    # Delete old DB folder to ensure no dummy data remains
    if os.path.exists(DB_PATH):
        try:
            shutil.rmtree(DB_PATH)
            print("   -> Deleted old database (Clean Start).")
        except:
            pass

    client = chromadb.PersistentClient(path=DB_PATH)
    collection = client.get_or_create_collection(name="bug_reports")
    
    # 4. DOWNLOAD EMBEDDING MODEL
    print("📥 Loading AI Model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # 5. GENERATE & SAVE
    print(f"🚀 Indexing {len(df)} bugs into memory...")
    
    batch_size = 500
    total = len(df)
    
    for i in range(0, total, batch_size):
        # Slice the batch
        batch = df.iloc[i : i+batch_size]
        
        docs = batch[target_col].tolist()
        ids = [str(x) for x in batch.index]
        
        # Metadata (Use 'Closed' if status column missing)
        metadatas = []
        for _, row in batch.iterrows():
            stat = row[status_col] if status_col else "Closed"
            metadatas.append({"status": str(stat)})

        # Encode (Text -> Numbers)
        embeddings = model.encode(docs).tolist()
        
        # Save to DB
        collection.add(
            documents=docs,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )
        
        # Progress Bar
        print(f"   Processed {min(i + batch_size, total)} / {total} bugs...", end='\r')

    print("\n\n✅ DONE! Memory built successfully.")
    print("   -> Now restart your backend: 'uvicorn main:app --reload'")

if __name__ == "__main__":
    build_memory()