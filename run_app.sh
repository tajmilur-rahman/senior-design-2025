#!/bin/bash

# Kill any old processes hanging around
pkill -f uvicorn
pkill -f vite

echo "Starting Bug Priority OS..."

# Start Backend in the background
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 & 

# Start Frontend
cd ../frontend
npm run dev