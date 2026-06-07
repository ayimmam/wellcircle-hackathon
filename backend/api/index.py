import os
from mangum import Mangum
from app.main import app

# Ensure Vercel runs in production mode
os.environ["ENVIRONMENT"] = "production"

# Create a handler wrapper for Serverless Functions
handler = Mangum(app)
