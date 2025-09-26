#!/usr/bin/env python3
"""
Separate Deployment Validation Script
Validates configuration for separate backend and frontend deployments
"""

import os
import sys
import json
from pathlib import Path
from decouple import config

def validate_backend_deployment():
    """Validate backend deployment configuration"""
    print("🔍 Validating Backend Deployment Configuration...")
    
    backend_dir = Path("backend")
    if not backend_dir.exists():
        print("❌ Backend directory not found!")
        return False
    
    # Check vercel.json in backend
    vercel_json = backend_dir / "vercel.json"
    if not vercel_json.exists():
        print("❌ backend/vercel.json not found!")
        return False
    
    try:
        with open(vercel_json, 'r') as f:
            config_data = json.load(f)
        
        # Validate builds
        builds = config_data.get('builds', [])
        has_wsgi = any('vercel_wsgi.py' in build.get('src', '') for build in builds)
        
        if not has_wsgi:
            print("❌ No WSGI build configuration found in backend/vercel.json")
            return False
        
        # Check for install command or build script
        has_install_cmd = 'installCommand' in config_data
        has_build_script = any('build_files.sh' in build.get('src', '') for build in builds)
        
        if not (has_install_cmd or has_build_script):
            print("⚠️  No install command or build script found (this may be okay for simple deployments)")
        else:
            print("✅ Installation method configured")
        
        print("✅ Backend vercel.json is properly configured")
        
    except Exception as e:
        print(f"❌ Error validating backend vercel.json: {e}")
        return False
    
    # Check essential files
    essential_files = [
        backend_dir / "dashboard/vercel_wsgi.py",
        backend_dir / "build_files.sh",
        backend_dir / "requirements.txt",
        backend_dir / ".env.example"
    ]
    
    for file_path in essential_files:
        if file_path.exists():
            print(f"✅ {file_path.name} exists")
        else:
            print(f"❌ {file_path.name} not found")
            return False
    
    return True

def validate_frontend_deployment():
    """Validate frontend deployment configuration"""
    print("\n🔍 Validating Frontend Deployment Configuration...")
    
    frontend_dir = Path("frontend")
    if not frontend_dir.exists():
        print("❌ Frontend directory not found!")
        return False
    
    # Check vercel.json in frontend
    vercel_json = frontend_dir / "vercel.json"
    if not vercel_json.exists():
        print("❌ frontend/vercel.json not found!")
        return False
    
    try:
        with open(vercel_json, 'r') as f:
            config_data = json.load(f)
        
        # Validate builds
        builds = config_data.get('builds', [])
        has_static_build = any('package.json' in build.get('src', '') for build in builds)
        
        if not has_static_build:
            print("❌ No static build configuration found in frontend/vercel.json")
            return False
        
        print("✅ Frontend vercel.json is properly configured")
        
    except Exception as e:
        print(f"❌ Error validating frontend vercel.json: {e}")
        return False
    
    # Check essential files
    essential_files = [
        frontend_dir / "package.json",
        frontend_dir / "vite.config.ts",
        frontend_dir / "index.html",
        frontend_dir / ".env.example"
    ]
    
    for file_path in essential_files:
        if file_path.exists():
            print(f"✅ {file_path.name} exists")
        else:
            print(f"❌ {file_path.name} not found")
            return False
    
    return True

def validate_environment_configurations():
    """Validate environment configurations for both deployments"""
    print("\n🔍 Validating Environment Configurations...")
    
    # Check backend .env.example
    backend_env = Path("backend/.env.example")
    if backend_env.exists():
        with open(backend_env, 'r') as f:
            backend_env_content = f.read()
        
        required_backend_vars = [
            'SECRET_KEY', 'DATABASE_URL', 'ALLOWED_HOSTS', 
            'FRONTEND_URL', 'DEBUG'
        ]
        
        for var in required_backend_vars:
            if var in backend_env_content:
                print(f"✅ Backend .env.example includes {var}")
            else:
                print(f"⚠️  Backend .env.example missing {var}")
    else:
        print("❌ Backend .env.example not found")
    
    # Check frontend .env.example
    frontend_env = Path("frontend/.env.example")
    if frontend_env.exists():
        with open(frontend_env, 'r') as f:
            frontend_env_content = f.read()
        
        required_frontend_vars = [
            'VITE_API_BASE_URL', 'VITE_APP_ENV'
        ]
        
        for var in required_frontend_vars:
            if var in frontend_env_content:
                print(f"✅ Frontend .env.example includes {var}")
            else:
                print(f"⚠️  Frontend .env.example missing {var}")
    else:
        print("❌ Frontend .env.example not found")
    
    return True

def validate_deployment_readiness():
    """Final deployment readiness check"""
    print("\n🔍 Final Deployment Readiness Check...")
    
    # Check if root vercel.json is properly configured for instruction only
    root_vercel = Path("vercel.json")
    if root_vercel.exists():
        try:
            with open(root_vercel, 'r') as f:
                config_data = json.load(f)
            
            if '_comment' in config_data and 'NOT USED' in config_data['_comment']:
                print("✅ Root vercel.json properly configured as instruction-only")
            else:
                print("⚠️  Root vercel.json may interfere with separate deployments")
        except Exception as e:
            print(f"⚠️  Could not validate root vercel.json: {e}")
    
    # Check if deployment instructions exist
    instructions_file = Path("deployment-instructions.html")
    if instructions_file.exists():
        print("✅ Deployment instructions available")
    else:
        print("⚠️  Deployment instructions not found")
    
    return True

def main():
    """Run all validation checks for separate deployments"""
    print("🚀 Separate Deployment Validation")
    print("=" * 60)
    
    # Ensure we're in the project root
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    print(f"Working directory: {Path.cwd()}")
    
    validations = [
        validate_backend_deployment,
        validate_frontend_deployment,
        validate_environment_configurations,
        validate_deployment_readiness
    ]
    
    all_passed = True
    for validation in validations:
        try:
            if not validation():
                all_passed = False
        except Exception as e:
            print(f"❌ Validation error: {e}")
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 All validations passed! Ready for separate deployments.")
        print("\n📋 Deployment Commands:")
        print("Backend:  cd backend && vercel --prod")
        print("Frontend: cd frontend && vercel --prod")
        print("\n📚 See deployment-instructions.html for detailed guide")
    else:
        print("⚠️  Some validations failed. Please fix the issues above.")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)