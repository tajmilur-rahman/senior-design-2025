import pandas as pd
from datasets import load_dataset
import os

def fetch_data():
    print("🚀 Connecting to Hugging Face Hub...")
    
    # We use a reliable dataset of 100k+ bugs (Eclipse/Bugzilla data)
    # This is perfect because it uses the exact same 'Severity' schema as Firefox
    try:
        # Load dataset (streaming=True lets us peek without downloading everything if we wanted)
        dataset = load_dataset("AliArshad/Bugzilla_Eclipse_Bug_Reports_Dataset", split="train")
        
        print(f"   -> Downloaded {len(dataset)} rows!")
        
        # Convert to Pandas
        df = dataset.to_pandas()
        
        # 🔍 INSPECT & RENAME
        # The dataset likely has 'Short Description' and 'Severity Label'
        print(f"   -> Columns found: {df.columns.tolist()}")
        
        # Normalize columns for our Universal Trainer
        # (We try common variations just to be safe)
        rename_map = {
            'Short Description': 'summary',
            'short_desc': 'summary',
            'description': 'summary',
            'Severity Label': 'severity',
            'severity': 'severity',
            'priority': 'severity'
        }
        
        df.rename(columns=rename_map, inplace=True)
        
        # Filter for only what we need
        if 'summary' in df.columns and 'severity' in df.columns:
            final_df = df[['summary', 'severity']]
            
            # Clean text (remove newlines, etc)
            final_df['summary'] = final_df['summary'].astype(str).str.replace('\n', ' ')
            
            # Save to CSV
            output_file = "data.csv"
            final_df.to_csv(output_file, index=False)
            print(f"✅ Success! Saved {len(final_df)} bugs to {output_file}")
            print("   -> Now run: python3 Train_Universal.py")
            
        else:
            print("❌ Error: Could not find 'summary' or 'severity' columns.")
            print("   -> Found these instead:", df.columns.tolist())

    except Exception as e:
        print(f"❌ Failed to download: {e}")

if __name__ == "__main__":
    fetch_data()