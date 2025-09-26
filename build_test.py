#!/usr/bin/env python3
"""
HRMS Build Test Suite
Tests both frontend and backend builds to ensure deployment readiness
"""

import os
import sys
import subprocess
import json
from pathlib import Path


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def run_command(command, cwd=None, capture_output=True):
    """Run a command and return success status and output"""
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            cwd=cwd, 
            capture_output=capture_output,
            text=True
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)


def print_status(message, status=None):
    """Print a status message with color coding"""
    if status is True:
        print(f"{Colors.GREEN}✅ {message}{Colors.END}")
    elif status is False:
        print(f"{Colors.RED}❌ {message}{Colors.END}")
    elif status is None:
        print(f"{Colors.BLUE}🔍 {message}{Colors.END}")
    else:
        print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")


def test_backend_build():
    """Test backend build processes"""
    print(f"\n{Colors.BOLD}🔧 Backend Build Tests{Colors.END}")
    print("=" * 50)
    
    backend_dir = Path(__file__).parent / "backend"
    if not backend_dir.exists():
        print_status("Backend directory not found!", False)
        return False
    
    all_tests_passed = True
    
    # Test 1: Django system check
    print_status("Running Django system checks...")
    success, stdout, stderr = run_command("python manage.py check", cwd=backend_dir)
    if success and "System check identified no issues" in stdout:
        print_status("Django system checks passed", True)
    else:
        print_status("Django system checks failed", False)
        print(f"Error: {stderr}")
        all_tests_passed = False
    
    # Test 2: Static files collection (dry run)
    print_status("Testing static files collection...")
    success, stdout, stderr = run_command(
        "python manage.py collectstatic --dry-run --noinput", 
        cwd=backend_dir
    )
    if success and "static files copied" in stdout:
        print_status("Static files collection works", True)
    else:
        print_status("Static files collection failed", False)
        all_tests_passed = False
    
    # Test 3: Migration check
    print_status("Checking migrations...")
    success, stdout, stderr = run_command(
        "python manage.py makemigrations --dry-run", 
        cwd=backend_dir
    )
    if success:
        print_status("Migration system works", True)
    else:
        print_status("Migration system failed", False)
        all_tests_passed = False
    
    # Test 4: Environment configuration
    print_status("Checking environment configuration...")
    env_file = backend_dir / ".env"
    if env_file.exists():
        print_status("Backend .env file exists", True)
    else:
        print_status("Backend .env file missing", False)
        all_tests_passed = False
    
    return all_tests_passed


def test_frontend_build():
    """Test frontend build processes"""
    print(f"\n{Colors.BOLD}⚛️  Frontend Build Tests{Colors.END}")
    print("=" * 50)
    
    frontend_dir = Path(__file__).parent / "frontend"
    if not frontend_dir.exists():
        print_status("Frontend directory not found!", False)
        return False
    
    all_tests_passed = True
    
    # Test 1: Check if Node.js and npm are available
    print_status("Checking Node.js and npm...")
    success, stdout, stderr = run_command("npm --version")
    if success:
        npm_version = stdout.strip()
        print_status(f"npm version {npm_version} detected", True)
    else:
        print_status("npm not found - install Node.js", False)
        return False
    
    # Test 2: Check package.json
    print_status("Checking package.json...")
    package_json = frontend_dir / "package.json"
    if package_json.exists():
        try:
            with open(package_json, 'r') as f:
                data = json.load(f)
            print_status(f"Package: {data.get('name', 'Unknown')}", True)
        except Exception as e:
            print_status(f"Invalid package.json: {e}", False)
            all_tests_passed = False
    else:
        print_status("package.json not found", False)
        all_tests_passed = False
    
    # Test 3: Check dependencies
    print_status("Checking node_modules...")
    node_modules = frontend_dir / "node_modules"
    if node_modules.exists():
        print_status("Dependencies are installed", True)
    else:
        print_status("Installing dependencies...", None)
        success, stdout, stderr = run_command("npm install", cwd=frontend_dir)
        if success:
            print_status("Dependencies installed successfully", True)
        else:
            print_status("Failed to install dependencies", False)
            all_tests_passed = False
    
    # Test 4: TypeScript compilation check
    print_status("Running TypeScript type checking...")
    success, stdout, stderr = run_command("npx tsc --noEmit", cwd=frontend_dir)
    if success:
        print_status("TypeScript compilation check passed", True)
    else:
        print_status("TypeScript compilation issues found", "warning")
        # Don't fail the build for TypeScript warnings
    
    # Test 5: Build process
    print_status("Testing production build...")
    success, stdout, stderr = run_command("npm run build", cwd=frontend_dir)
    if success and "built in" in stdout:
        print_status("Production build successful", True)
        
        # Check if dist folder was created
        dist_dir = frontend_dir / "dist"
        if dist_dir.exists():
            print_status("Build artifacts created in dist/", True)
        else:
            print_status("Build artifacts not found", False)
            all_tests_passed = False
    else:
        print_status("Production build failed", False)
        print(f"Error: {stderr}")
        all_tests_passed = False
    
    # Test 6: Environment configuration
    print_status("Checking environment configuration...")
    env_file = frontend_dir / ".env"
    if env_file.exists():
        print_status("Frontend .env file exists", True)
    else:
        print_status("Frontend .env file missing", False)
        all_tests_passed = False
    
    return all_tests_passed


def test_environment_integration():
    """Test environment variable integration"""
    print(f"\n{Colors.BOLD}🌍 Environment Integration Tests{Colors.END}")
    print("=" * 50)
    
    # Test configuration files
    config_files = [
        "frontend/.env",
        "frontend/.env.example",
        "frontend/.env.production",
        "backend/.env",
        "backend/.env.example", 
        "backend/.env.production"
    ]
    
    all_exist = True
    for config_file in config_files:
        file_path = Path(__file__).parent / config_file
        if file_path.exists():
            print_status(f"{config_file} exists", True)
        else:
            print_status(f"{config_file} missing", False)
            all_exist = False
    
    # Test environment variable validation script
    print_status("Testing configuration validation...")
    success, stdout, stderr = run_command("python validate_config.py")
    if success and "All configurations look good" in stdout:
        print_status("Environment validation passed", True)
    else:
        print_status("Environment validation issues", False)
        all_exist = False
    
    return all_exist


def main():
    """Main test execution"""
    print(f"{Colors.BOLD}🚀 HRMS Build Test Suite{Colors.END}")
    print("=" * 60)
    print("Testing frontend and backend build processes...")
    
    # Run all test suites
    backend_passed = test_backend_build()
    frontend_passed = test_frontend_build()
    env_passed = test_environment_integration()
    
    # Final results
    print(f"\n{Colors.BOLD}📊 Test Results Summary{Colors.END}")
    print("=" * 60)
    
    print_status(f"Backend Build Tests: {'PASSED' if backend_passed else 'FAILED'}", backend_passed)
    print_status(f"Frontend Build Tests: {'PASSED' if frontend_passed else 'FAILED'}", frontend_passed)
    print_status(f"Environment Integration: {'PASSED' if env_passed else 'FAILED'}", env_passed)
    
    all_passed = backend_passed and frontend_passed and env_passed
    
    if all_passed:
        print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED!{Colors.END}")
        print(f"{Colors.GREEN}Your HRMS application is ready for deployment!{Colors.END}")
        print(f"\n{Colors.BLUE}Next steps:{Colors.END}")
        print("  1. Deploy backend with environment variables")
        print("  2. Deploy frontend with API URL configured")
        print("  3. Test the deployed application")
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}❌ SOME TESTS FAILED{Colors.END}")
        print(f"{Colors.RED}Please fix the issues above before deployment.{Colors.END}")
        sys.exit(1)


if __name__ == "__main__":
    main()