import os
import sys
import subprocess
from pathlib import Path

# Add the project directory to the Python path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')

# Ensure static files are collected
try:
    staticfiles_dir = BASE_DIR / 'staticfiles'
    if not staticfiles_dir.exists():
        print("Collecting static files for Vercel deployment...")
        os.chdir(BASE_DIR)
        subprocess.run([sys.executable, 'manage.py', 'collectstatic', '--noinput'], check=True)
        print("Static files collected successfully!")
except Exception as e:
    print(f"Static files collection failed: {e}")

# Import Django WSGI application
from django.core.wsgi import get_wsgi_application

# Initialize Django
application = get_wsgi_application()

# Vercel serverless handler - the app variable is what Vercel expects
app = application
