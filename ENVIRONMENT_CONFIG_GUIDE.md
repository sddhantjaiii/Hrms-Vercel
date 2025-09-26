# Environment-Based Configuration Guide

This guide explains how to configure the HRMS application for different environments using environment variables.

## 🏗️ Architecture Overview

The application consists of:
- **Frontend**: React/Vite application with TypeScript
- **Backend**: Django REST API with PostgreSQL

Both components are now fully configurable via environment variables for flexible deployment.

## 📁 Configuration Files Structure

```
hrms-v1/
├── .env.example                 # Root level example (for reference)
├── frontend/
│   ├── .env                     # Development config
│   ├── .env.production          # Production config
│   └── .env.example             # Frontend example
└── backend/
    ├── .env                     # Development config
    ├── .env.production          # Production config
    └── .env.example             # Backend example
```

## 🚀 Quick Setup

### 1. Development Setup

**Frontend (.env):**
```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_ENABLE_DEBUG=true
```

**Backend (.env):**
```bash
SECRET_KEY=dev-secret-key
DEBUG=True
FRONTEND_URL=http://localhost:5173
FORCE_CORS_ALL_ORIGINS=True
```

### 2. Production Setup

**Frontend (.env.production):**
```bash
VITE_API_BASE_URL=https://your-backend-domain.com
VITE_ENABLE_DEBUG=false
```

**Backend (.env.production):**
```bash
SECRET_KEY=your-production-secret
DEBUG=False
FRONTEND_URL=https://your-frontend-domain.com
FORCE_CORS_ALL_ORIGINS=False
```

## 🎯 Environment Variables Reference

### Frontend Variables (VITE_*)

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `VITE_API_BASE_URL` | Primary API URL | Auto-detected | `https://api.example.com` |
| `VITE_DEV_API_URL` | Development API URL | `http://127.0.0.1:8000` | `http://localhost:8000` |
| `VITE_PROD_API_URL` | Production fallback API URL | Current domain | `https://api.prod.com` |
| `VITE_APP_NAME` | Application name | `HRMS Dashboard` | `My HRMS` |
| `VITE_ENABLE_DEBUG` | Enable debug mode | `false` | `true` |
| `VITE_ENABLE_ANALYTICS` | Enable analytics | `false` | `true` |

### Backend Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `SECRET_KEY` | Django secret key | - | `your-secret-key` |
| `DEBUG` | Debug mode | `False` | `True` |
| `ALLOWED_HOSTS` | Allowed hosts | `localhost` | `example.com,api.example.com` |
| `FRONTEND_URL` | Main frontend URL | - | `https://app.example.com` |
| `ADDITIONAL_FRONTEND_URLS` | Extra frontend URLs | - | `https://staging.example.com` |
| `FORCE_CORS_ALL_ORIGINS` | Allow all CORS origins | `False` | `True` |
| `VERCEL` | Vercel deployment flag | `False` | `True` |
| `FORCE_HTTPS` | Force HTTPS | `False` | `True` |

## 🏭 Deployment Scenarios

### Scenario 1: Local Development
```bash
# Frontend
VITE_API_BASE_URL=http://127.0.0.1:8000

# Backend
DEBUG=True
FRONTEND_URL=http://localhost:5173
FORCE_CORS_ALL_ORIGINS=True
```

### Scenario 2: Vercel Production
```bash
# Frontend (Vercel Environment Variables)
VITE_API_BASE_URL=https://your-backend.vercel.app

# Backend (Vercel Environment Variables)
DEBUG=False
FRONTEND_URL=https://your-frontend.vercel.app
VERCEL=True
FORCE_HTTPS=True
```

### Scenario 3: Custom Domain Production
```bash
# Frontend
VITE_API_BASE_URL=https://api.yourcompany.com

# Backend
DEBUG=False
FRONTEND_URL=https://hrms.yourcompany.com
ALLOWED_HOSTS=api.yourcompany.com,yourcompany.com
```

### Scenario 4: Multiple Environments
```bash
# Backend - Support multiple frontend deployments
FRONTEND_URL=https://hrms-prod.example.com
ADDITIONAL_FRONTEND_URLS=https://hrms-staging.example.com,https://hrms-dev.example.com
```

## 🔧 Configuration Priority

### Frontend API URL Resolution:
1. `VITE_API_BASE_URL` (highest priority)
2. `VITE_DEV_API_URL` (for localhost)
3. `VITE_PROD_API_URL` (fallback)
4. Auto-detection based on current domain

### Backend CORS Origins:
1. `FORCE_CORS_ALL_ORIGINS=True` → Allow all origins
2. `FRONTEND_URL` → Primary frontend URL
3. `ADDITIONAL_FRONTEND_URLS` → Additional allowed URLs
4. Development URLs (if DEBUG=True)

## 📋 Deployment Checklist

### Before Deployment:
- [ ] Copy `.env.example` to `.env` in both frontend and backend
- [ ] Update all environment variables with production values
- [ ] Test API connectivity between frontend and backend
- [ ] Verify CORS configuration
- [ ] Check HTTPS enforcement settings

### After Deployment:
- [ ] Test all API endpoints
- [ ] Verify frontend can connect to backend
- [ ] Check browser console for CORS errors
- [ ] Test authentication flow
- [ ] Verify file upload functionality (if applicable)

## 🐛 Troubleshooting

### CORS Issues:
```bash
# For development - allow all origins
FORCE_CORS_ALL_ORIGINS=True

# For production - specify exact URLs
FRONTEND_URL=https://your-exact-frontend-url.com
```

### API Connection Issues:
```bash
# Check if API URL is correctly set
console.log(API_CONFIG.getEnvironmentInfo()); // In browser console
```

### HTTPS Issues:
```bash
# Force HTTPS in production
FORCE_HTTPS=True
VERCEL=True  # If using Vercel
```

## 🔍 Environment Info Debug

The frontend includes a debug function to check environment configuration:

```javascript
// In browser console
console.log(API_CONFIG.getEnvironmentInfo());
```

This will show:
- Current environment mode
- Resolved API URL
- All environment variables
- Hostname information

## 🚀 Quick Commands

### Start Development:
```bash
# Frontend
cd frontend
npm run dev

# Backend
cd backend
python manage.py runserver
```

### Build for Production:
```bash
# Frontend
cd frontend
npm run build

# Backend
cd backend
python manage.py collectstatic
```

## 📚 Additional Resources

- [Vite Environment Variables Guide](https://vitejs.dev/guide/env-and-mode.html)
- [Django Settings Documentation](https://docs.djangoproject.com/en/stable/topics/settings/)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)