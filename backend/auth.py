# backend/auth.py
from pydantic import BaseModel
from typing import Optional

# --- Pydantic Models ---
class LoginRequest(BaseModel):
    username: str
    password: str

class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "user"

# --- Helper Functions (Optional but good to keep) ---
# You can add token generation logic here later if needed