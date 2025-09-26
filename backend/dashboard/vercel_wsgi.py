import os
import sys
from pathlib import Path

# Add the project directory to the Python path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')

# Import Django WSGI application
from django.core.wsgi import get_wsgi_application

# Initialize Django
application = get_wsgi_application()

# Vercel serverless handler
def handler(event, context):
    return application(event, context)
