import pandas as pd
from datasets import load_dataset
import os


def fetch_data():
    print("🚀 Connecting to Hugging Face Hub...")

    try:
        # Load Bugzilla dataset (Eclipse/Mozilla format)
        dataset = load_dataset("AliArshad/Bugzilla_Eclipse_Bug_Reports_Dataset", split="train")
        print(f"   -> Downloaded {len(dataset)} rows!")

        df = dataset.to_pandas()

        # Standardize column names
        rename_map = {
            'Short Description': 'summary',
            'short_desc': 'summary',
            'description': 'summary',
            'Severity Label': 'severity',
            'severity': 'severity',
            'priority': 'severity'
        }
        df.rename(columns=rename_map, inplace=True)

        # Basic cleanup: Remove rows with missing essential data
        if 'summary' in df.columns and 'severity' in df.columns:
            final_df = df[['summary', 'severity']].dropna()

            # Clean text (remove newlines and extra spaces)
            final_df['summary'] = final_df['summary'].astype(str).str.replace(r'\n', ' ', regex=True).str.strip()

            # Save to the backend data folder for consistency
            output_file = "../backend/data.csv"
            final_df.to_csv(output_file, index=False)

            print(f"✅ Success! Saved {len(final_df)} bugs to {output_file}")
            print("   -> Now run: python ml_trainer.py")
        else:
            print(f"❌ Error: Missing columns. Found: {df.columns.tolist()}")

    except Exception as e:
        print(f"❌ Failed to download: {e}")


if __name__ == "__main__":
    fetch_data()