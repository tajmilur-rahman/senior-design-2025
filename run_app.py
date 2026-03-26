import subprocess
import sys
import os
import time
import urllib.request
import webbrowser

def kill_port(port):
    """Finds and kills any process using the specified port on Windows."""
    try:
        result = subprocess.check_output(f"netstat -ano | findstr :{port}", shell=True).decode()
        lines = result.strip().split('\n')
        for line in lines:
            if "LISTENING" in line:
                pid = line.strip().split()[-1]
                os.system(f"taskkill /F /PID {pid} >nul 2>&1")
                print(f"🧹 Cleared old process (PID {pid}) on port {port}")
    except Exception:
        pass

def main():
    print("🧹 Checking for lingering background processes...")
    kill_port(8000)
    kill_port(5173)
    time.sleep(1)

    print("\n🚀 Booting up Bug Priority OS...")

    # ⚡ NEW STEP 1: Execute the ETL Taxonomy Sync Script Automatically
    print("-> Triggering ETL Data Sync...")
    try:
        subprocess.run([sys.executable, "backend/scripts/sync_taxonomy.py"], check=True)
    except Exception as e:
        print(f"⚠️ Warning: ETL Sync Failed: {e}. Starting with cached javascript.")

    # Step 2: Start FastAPI Backend
    print("-> Starting FastAPI Backend (Port 8000)...")
    backend = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd="backend"
    )

    # Wait for backend to be ready before starting frontend
    print("-> Waiting for backend to be ready...", end="", flush=True)
    for _ in range(30):
        try:
            urllib.request.urlopen("http://localhost:8000/docs", timeout=1)
            break
        except Exception:
            time.sleep(1)
            print(".", end="", flush=True)
    print(" ready!")

    # Step 3: Start React Frontend
    print("-> Starting React Frontend...")
    frontend = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd="frontend",
        shell=True
    )

    # Wait for frontend dev server, then open browser automatically
    print("-> Waiting for frontend to be ready...", end="", flush=True)
    for _ in range(30):
        try:
            urllib.request.urlopen("http://localhost:5173", timeout=1)
            break
        except Exception:
            time.sleep(1)
            print(".", end="", flush=True)
    print(" ready!")
    print("-> Opening browser...")
    webbrowser.open("http://localhost:5173")

    try:
        backend.wait()
        frontend.wait()
    except KeyboardInterrupt:
        print("\n🛑 Ctrl+C detected. Shutting down servers...")
        backend.terminate()
        frontend.terminate()
        print("✅ All systems offline.")

if __name__ == "__main__":
    main()