#!/usr/bin/env python3
"""
Vercel Deployment Validation Script
Validates all configuration for Vercel deployment
"""

import os
import sys
import json
from pathlib import Path
from decouple import config

def validate_vercel_config():
    """Validate vercel.json configuration"""
    print("🔍 Validating vercel.json configuration...")
    
    vercel_json_path = Path("vercel.json")
    if not vercel_json_path.exists():
        print("❌ vercel.json not found!")
        return False
    
    try:
        with open(vercel_json_path, 'r') as f:
            vercel_config = json.load(f)
        
        # Check required fields
        required_fields = ['version', 'builds', 'routes']
        for field in required_fields:
            if field not in vercel_config:
                print(f"❌ Missing required field: {field}")
                return False
        
        # Validate builds
        builds = vercel_config.get('builds', [])
        wsgi_build = None
        static_build = None
        
        for build in builds:
            if 'vercel_wsgi.py' in build.get('src', ''):
                wsgi_build = build
            elif 'build_files.sh' in build.get('src', ''):
                static_build = build
        
        if not wsgi_build:
            print("❌ No vercel_wsgi.py build configuration found")
            return False
        
        if not static_build:
            print("❌ No build_files.sh configuration found")
            return False
        
        print("✅ vercel.json configuration is valid")
        return True
        
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in vercel.json: {e}")
        return False
    except Exception as e:
        print(f"❌ Error validating vercel.json: {e}")
        return False

def validate_django_settings():
    """Validate Django settings for deployment"""
    print("\n🔍 Validating Django settings...")
    
    # Set up paths for backend
    current_dir = Path.cwd()
    backend_path = current_dir / "backend"
    if backend_path.exists():
        sys.path.insert(0, str(backend_path))
    
    try:
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
        
        # Test critical settings
        secret_key = config('SECRET_KEY', default='')
        if not secret_key or secret_key == 'your-secret-key-here':
            print("⚠️  SECRET_KEY not properly configured")
        else:
            print("✅ SECRET_KEY is configured")
        
        # Test database URL
        database_url = config('DATABASE_URL', default='')
        if not database_url:
            print("⚠️  DATABASE_URL not configured")
        else:
            print("✅ DATABASE_URL is configured")
        
        # Test allowed hosts
        allowed_hosts = config('ALLOWED_HOSTS', default='localhost')
        if 'vercel.app' not in allowed_hosts:
            print("⚠️  ALLOWED_HOSTS may not include Vercel domain")
        else:
            print("✅ ALLOWED_HOSTS includes Vercel domain")
        
        # Test CORS configuration
        frontend_url = config('FRONTEND_URL', default='')
        if not frontend_url:
            print("⚠️  FRONTEND_URL not configured")
        else:
            print("✅ FRONTEND_URL is configured")
        
        return True
        
    except Exception as e:
        print(f"❌ Error validating Django settings: {e}")
        return False

def validate_wsgi_files():
    """Validate WSGI files exist and are properly configured"""
    print("\n🔍 Validating WSGI files...")
    
    wsgi_files = [
        Path("backend/dashboard/wsgi.py"),
        Path("backend/dashboard/vercel_wsgi.py")
    ]
    
    all_valid = True
    for wsgi_file in wsgi_files:
        if wsgi_file.exists():
            print(f"✅ {wsgi_file.name} exists")
            
            # Check if it imports the application
            try:
                with open(wsgi_file, 'r') as f:
                    content = f.read()
                    if 'application' in content:
                        print(f"✅ {wsgi_file.name} defines application")
                    else:
                        print(f"⚠️  {wsgi_file.name} may not define application properly")
            except Exception as e:
                print(f"❌ Error reading {wsgi_file.name}: {e}")
                all_valid = False
        else:
            print(f"❌ {wsgi_file.name} not found")
            all_valid = False
    
    return all_valid

def validate_build_script():
    """Validate build script exists and is executable"""
    print("\n🔍 Validating build script...")
    
    build_script = Path("backend/build_files.sh")
    if not build_script.exists():
        print("❌ build_files.sh not found")
        return False
    
    try:
        with open(build_script, 'r') as f:
            content = f.read()
            
        # Check for required commands
        required_commands = [
            'pip install',
            'python manage.py collectstatic',
            'python manage.py check'
        ]
        
        for cmd in required_commands:
            if cmd in content:
                print(f"✅ Build script includes: {cmd}")
            else:
                print(f"⚠️  Build script missing: {cmd}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error validating build script: {e}")
        return False

def validate_environment_files():
    """Validate environment files"""
    print("\n🔍 Validating environment files...")
    
    env_files = [
        Path("backend/.env.example"),
        Path("frontend/.env.example")
    ]
    
    for env_file in env_files:
        if env_file.exists():
            print(f"✅ {env_file} exists")
        else:
            print(f"⚠️  {env_file} not found")
    
    return True

def main():
    """Run all validation checks"""
    print("🚀 Vercel Deployment Validation")
    print("=" * 50)
    
    # Ensure we're in the project root
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    print(f"Working directory: {Path.cwd()}")
    
    validations = [
        validate_vercel_config,
        validate_django_settings,
        validate_wsgi_files,
        validate_build_script,
        validate_environment_files
    ]
    
    all_passed = True
    for validation in validations:
        try:
            if not validation():
                all_passed = False
        except Exception as e:
            print(f"❌ Validation error: {e}")
            all_passed = False
    
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 All validations passed! Ready for Vercel deployment.")
        print("\nNext steps:")
        print("1. Commit all changes to git")
        print("2. Push to your repository")
        print("3. Deploy to Vercel")
        print("4. Set environment variables in Vercel dashboard")
    else:
        print("⚠️  Some validations failed. Please fix the issues above.")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)