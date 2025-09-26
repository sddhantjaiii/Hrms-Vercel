# GitIgnore Configuration Guide

This document explains the GitIgnore setup for the HRMS project to ensure proper version control practices.

## 📁 GitIgnore File Structure

```
hrms-v1/
├── .gitignore              # Root level - covers entire project
├── frontend/.gitignore     # Frontend specific ignores
└── backend/.gitignore      # Backend specific ignores
```

## 🔒 Environment File Handling

### ✅ Files INCLUDED in Git (Safe to commit):
- `.env.example` - Template files with placeholder values
- `.env.production` - Production template (without actual secrets)
- Configuration documentation files

### ❌ Files EXCLUDED from Git (Contains secrets):
- `.env` - Development environment variables
- `.env.local` - Local overrides
- `.env.development` - Development specific secrets
- `.env.test` - Test environment secrets
- `.env.staging` - Staging environment secrets
- Any file matching `*.local.env`

## 🔧 What's Ignored by Category

### Frontend Ignores:
```bash
# Build outputs
dist/
build/
.vite/
.next/

# Dependencies
node_modules/
.pnpm-store/

# Environment files
.env
.env.local
.env.*.local

# Development files
npm-debug.log*
yarn-debug.log*
coverage/
```

### Backend Ignores:
```bash
# Python
__pycache__/
*.pyc
venv/
*.egg-info/

# Django
db.sqlite3
media/
staticfiles/
local_settings.py

# Environment files
.env
.env.local
logs/
```

### Shared Ignores:
```bash
# IDE files
.vscode/
.idea/
*.sublime-*

# OS files
.DS_Store
Thumbs.db
Desktop.ini

# Temporary files
*.log
*.tmp
*.swp
*.bak
```

## 🚀 Deployment Platform Ignores

```bash
# Vercel
.vercel

# Netlify
.netlify

# AWS
.aws/

# Docker
docker-compose.override.yml
```

## 📋 Best Practices

### ✅ DO:
- Commit `.env.example` files with placeholder values
- Keep configuration templates in version control
- Document environment variables in README files
- Use descriptive placeholder values (e.g., `your-api-key-here`)

### ❌ DON'T:
- Commit actual `.env` files with real secrets
- Commit database files or user uploads
- Commit build artifacts or dependencies
- Commit IDE-specific configuration files

## 🔍 Verification Commands

Check what files are being tracked:
```bash
# Show all tracked files
git ls-files

# Show ignored files
git status --ignored

# Check if a specific file is ignored
git check-ignore -v filename
```

## 🛠️ Troubleshooting

### If you accidentally committed a .env file:
```bash
# Remove from tracking but keep locally
git rm --cached .env

# Add to .gitignore if not already there
echo ".env" >> .gitignore

# Commit the removal
git commit -m "Remove .env from tracking"
```

### If .gitignore changes aren't working:
```bash
# Clear git cache and re-add files
git rm -r --cached .
git add .
git commit -m "Apply .gitignore changes"
```

## 📝 Environment File Templates

### Frontend `.env.example`:
```bash
# API Configuration
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_DEV_API_URL=http://127.0.0.1:8000
VITE_PROD_API_URL=https://your-backend-domain.com

# App Configuration
VITE_APP_NAME=HRMS Dashboard
VITE_ENABLE_DEBUG=false
```

### Backend `.env.example`:
```bash
# Django Configuration
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com

# Database Configuration
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_HOST=localhost
DB_PORT=5432

# Frontend URL Configuration
FRONTEND_URL=http://localhost:3000
```

## 🔄 Team Workflow

1. **Initial Setup**: Each developer copies `.env.example` to `.env` and fills in their values
2. **Adding New Variables**: Update `.env.example` with new placeholder values
3. **Documentation**: Document new environment variables in README
4. **Review**: Ensure no secrets are committed during code reviews

## 🚨 Security Notes

- Never commit real API keys, passwords, or tokens
- Use environment variables for all sensitive configuration
- Regularly rotate secrets and update deployment environments
- Use different values for development, staging, and production
- Consider using secret management services for production

This configuration ensures that your sensitive information stays secure while maintaining easy setup for new developers and deployment environments.