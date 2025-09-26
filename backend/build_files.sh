#!/bin/bash

# Build script for Vercel Django deployment
echo "Starting Django build process for Vercel..."

# Install dependencies
echo "Installing Python dependencies..."
python3 -m pip install -r requirements.txt

# Run Django system checks
echo "Running Django system checks..."
python3 manage.py check --deploy

# Collect static files
echo "Collecting static files..."
python3 manage.py collectstatic --noinput --clear

# Create necessary directories
echo "Creating required directories..."
mkdir -p media
mkdir -p logs

# Set proper permissions (if needed)
chmod -R 755 staticfiles
chmod -R 755 media

echo "Build completed successfully!"
echo "Static files location: $(pwd)/staticfiles"
echo "Media files location: $(pwd)/media"
