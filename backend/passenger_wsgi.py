"""
Phusion Passenger WSGI entry point for cPanel shared hosting.

Passenger speaks WSGI; FastAPI is ASGI. The a2wsgi adapter bridges the gap
so the app runs under cPanel's managed Python environment without any extra
process managers (gunicorn/uvicorn).

Install the adapter in the cPanel virtual environment:
    pip install a2wsgi==1.10.4
"""
import sys
import os

# Ensure 'app' package is importable from this directory
sys.path.insert(0, os.path.dirname(__file__))

# Force production mode — disables create_all and enables tighter error handling
os.environ["ENVIRONMENT"] = "production"

# Import the FastAPI instance
from app.main import app as fastapi_app

# Bridge ASGI → WSGI so Passenger can serve it
from a2wsgi import ASGIMiddleware

# Passenger looks specifically for a callable named 'application'
application = ASGIMiddleware(fastapi_app)
