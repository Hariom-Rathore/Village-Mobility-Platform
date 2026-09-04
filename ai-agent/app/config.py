"""
Configuration for RideLocal AI Agent Service
"""
import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load ai-agent/.env regardless of the current working directory.
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)


class Settings:
    """Application settings"""
    
    def __init__(self):
        # AI Service
        self.AI_SERVICE_NAME = os.getenv("AI_SERVICE_NAME", "ridelocal-ai-agent")
        self.AI_SERVICE_VERSION = os.getenv("AI_SERVICE_VERSION", "1.0.0")
        self.AI_SERVICE_PORT = int(os.getenv("AI_SERVICE_PORT", "8000"))
        
        # LLM Configuration
        self.LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai")
        self.LLM_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("LLM_API_KEY", "")
        self.LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
        self.LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.7"))
        self.LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "1000"))
        
        # RideLocal Backend
        self.RIDELocal_BACKEND_URL = os.getenv("RIDELocal_BACKEND_URL", "http://localhost:8081")
        self.RIDELocal_API_TIMEOUT = int(os.getenv("RIDELocal_API_TIMEOUT", "60"))
        
        # Authentication
        self.JWT_SECRET = os.getenv("JWT_SECRET", "")
        self.SESSION_SECRET = os.getenv("SESSION_SECRET", "")
        
        # Logging
        self.LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


settings = Settings()
