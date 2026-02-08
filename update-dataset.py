import requests
import csv
import os
import pandas as pd
from datetime import datetime

# 1. SETUP: Where is your old file?
OLD_FILE = "data.csv"  # Rename this to match your actual file name
NEW_FILE = "firefox_bugs_full_2026.csv"

# 2. CONFIG: Date to start fetching from (The day your old data ends)
# Since your data is 3 years old, let's start from Jan 1, 2023
START_DATE = "2023-01-01"

print(f"--- FETCHING DATA FROM {START_DATE} TO NOW ---")

# Mozilla API URL
URL = "https://bugzilla.mozilla.org/rest/bug"

# We need to loop because the API only gives 1000 at a time
bugs_collected = []
offset = 0
limit = 1000

while True:
    params = {
        "product": "Firefox",
        "include_fields": "id,summary,status,severity,creation_time",
        "creation_time": START_DATE,
        "limit": limit,
        "offset": offset,
        "order": "creation_time ASC"
    }
    
    print(f"Fetching batch: bugs {offset} to {offset + limit}...")
    response = requests.get(URL, params=params)
    data = response.json()
    
    if 'bugs' not in data or len(data['bugs']) == 0:
        break # Stop if no more bugs
        
    bugs_collected.extend(data['bugs'])
    offset += limit

print(f"--- DOWNLOAD COMPLETE: {len(bugs_collected)} NEW BUGS FOUND ---")

# 3. MERGE WITH OLD DATA
# Convert new bugs to DataFrame
df_new = pd.DataFrame(bugs_collected)
# Rename columns to match your old file (Adjust these names if needed!)
df_new.rename(columns={'summary': 'description', 'creation_time': 'date'}, inplace=True)

# Check if old file exists
if os.path.exists(OLD_FILE):
    print("Loading old dataset...")
    df_old = pd.read_csv(OLD_FILE)
    
    # Combine them
    df_final = pd.concat([df_old, df_new], ignore_index=True)
    
    # Remove duplicates (just in case)
    df_final.drop_duplicates(subset=['id'], inplace=True)
    
    print(f"Merging... Old: {len(df_old)} + New: {len(df_new)} = Total: {len(df_final)}")
    df_final.to_csv(NEW_FILE, index=False)
    print(f"SUCCESS! Created {NEW_FILE} with ALL data.")
else:
    print("Old file not found. Saving just the new data.")
    df_new.to_csv(NEW_FILE, index=False)