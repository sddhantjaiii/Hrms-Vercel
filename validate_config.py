#!/usr/bin/env python3
"""
Configuration Validation Script for HRMS Application
This script helps validate that environment variables are properly set.
"""

import os
import sys
from pathlib import Path


def check_backend_config():
    """Check backend environment configuration"""
    print("🔍 Checking Backend Configuration...")
    
    backend_dir = Path(__file__).parent / "backend"
    env_file = backend_dir / ".env"
    
    if not env_file.exists():
        print("❌ Backend .env file not found!")
        print(f"   Expected: {env_file}")
        return False
    
    # Load environment variables from .env file
    try:
        with open(env_file, 'r') as f:
            lines = f.readlines()
        
        env_vars = {}
        for line in lines:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env_vars[key.strip()] = value.strip()
        
        required_vars = ['SECRET_KEY', 'DEBUG', 'FRONTEND_URL']
        missing_vars = []
        
        for var in required_vars:
            if var not in env_vars or not env_vars[var]:
                missing_vars.append(var)
        
        if missing_vars:
            print(f"❌ Missing backend variables: {', '.join(missing_vars)}")
            return False
        
        print("✅ Backend configuration looks good!")
        print(f"   DEBUG: {env_vars.get('DEBUG', 'Not set')}")
        print(f"   FRONTEND_URL: {env_vars.get('FRONTEND_URL', 'Not set')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error reading backend .env file: {e}")
        return False


def check_frontend_config():
    """Check frontend environment configuration"""
    print("\n🔍 Checking Frontend Configuration...")
    
    frontend_dir = Path(__file__).parent / "frontend"
    env_file = frontend_dir / ".env"
    
    if not env_file.exists():
        print("❌ Frontend .env file not found!")
        print(f"   Expected: {env_file}")
        return False
    
    try:
        with open(env_file, 'r') as f:
            lines = f.readlines()
        
        env_vars = {}
        for line in lines:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env_vars[key.strip()] = value.strip()
        
        api_url = env_vars.get('VITE_API_BASE_URL', '')
        if not api_url:
            print("⚠️  VITE_API_BASE_URL not set (will use auto-detection)")
        else:
            print(f"✅ API URL configured: {api_url}")
        
        debug = env_vars.get('VITE_ENABLE_DEBUG', 'false')
        print(f"   Debug mode: {debug}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error reading frontend .env file: {e}")
        return False


def check_cors_compatibility():
    """Check if backend and frontend URLs are compatible for CORS"""
    print("\n🔍 Checking CORS Compatibility...")
    
    try:
        # Read backend config
        backend_env = Path(__file__).parent / "backend" / ".env"
        frontend_env = Path(__file__).parent / "frontend" / ".env"
        
        backend_vars = {}
        frontend_vars = {}
        
        if backend_env.exists():
            with open(backend_env, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        backend_vars[key.strip()] = value.strip()
        
        if frontend_env.exists():
            with open(frontend_env, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        frontend_vars[key.strip()] = value.strip()
        
        frontend_url = backend_vars.get('FRONTEND_URL', '')
        api_url = frontend_vars.get('VITE_API_BASE_URL', '')
        
        if frontend_url and api_url:
            print(f"   Backend expects frontend at: {frontend_url}")
            print(f"   Frontend will call API at: {api_url}")
            print("✅ CORS configuration can be verified manually")
        else:
            print("⚠️  Could not verify CORS configuration - URLs not fully set")
        
        return True
        
    except Exception as e:
        print(f"❌ Error checking CORS compatibility: {e}")
        return False


def main():
    """Main validation function"""
    print("🚀 HRMS Configuration Validator")
    print("=" * 50)
    
    backend_ok = check_backend_config()
    frontend_ok = check_frontend_config()
    cors_ok = check_cors_compatibility()
    
    print("\n" + "=" * 50)
    if backend_ok and frontend_ok and cors_ok:
        print("✅ All configurations look good!")
        print("\n📋 Next Steps:")
        print("   1. Start the backend: cd backend && python manage.py runserver")
        print("   2. Start the frontend: cd frontend && npm run dev")
        print("   3. Check browser console for any connection errors")
    else:
        print("❌ Some configurations need attention!")
        print("\n📋 Fix the issues above and run this script again.")
        sys.exit(1)


if __name__ == "__main__":
    main()