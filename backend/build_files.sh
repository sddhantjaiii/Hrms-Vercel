#!/bin/bash

# Install dependencies
pip install -r requirements.txt

# Collect static files
python manage.py collectstatic --noinput --clear

# Create media directory if it doesn't exist
mkdir -p media

echo "Build completed successfully!"
