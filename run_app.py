import subprocess
import sys
import os
import time

def kill_port(port):
    """Finds and kills any process using the specified port on Windows."""
    try:
        # Use netstat to find the PID listening on the port
        result = subprocess.check_output(f"netstat -ano | findstr :{port}", shell=True).decode()
        lines = result.strip().split('\n')
        for line in lines:
            if "LISTENING" in line:
                pid = line.strip().split()[-1]
                # Force kill the PID
                os.system(f"taskkill /F /PID {pid} >nul 2>&1")
                print(f"🧹 Cleared old process (PID {pid}) on port {port}")
    except Exception:
        # If the port is already free, it throws an exception which we can just ignore
        pass

def main():
    print("🧹 Checking for lingering background processes...")
    kill_port(8000) # Clear FastAPI port
    kill_port(5173) # Clear Vite port (change if your Vite uses a different default)
    time.sleep(1)   # Give Windows a second to free the ports

    print("\n🚀 Booting up Bug Priority OS...")

    # 1. Start FastAPI Backend
    # Using sys.executable ensures it uses your active .venv Python
    print("-> Starting FastAPI Backend (Port 8000)...")
    backend = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd="backend"
    )

    # 2. Start React Frontend
    print("-> Starting React Frontend...")
    frontend = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd="frontend",
        shell=True # shell=True is required on Windows to resolve 'npm' commands
    )

    try:
        # Keep the script running and listening to both processes
        backend.wait()
        frontend.wait()
    except KeyboardInterrupt:
        # Gracefully handle Ctrl+C to kill both servers at once
        print("\n🛑 Ctrl+C detected. Shutting down servers...")
        backend.terminate()
        frontend.terminate()
        print("✅ All systems offline.")

if __name__ == "__main__":
    main()