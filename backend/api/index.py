import os
import sys

# Add backend directory to path so app.main can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app

# Ensure Vercel runs in production mode
os.environ["ENVIRONMENT"] = "production"
