# HRMS Separate Deployment Guide

## Overview
This guide covers deploying the HRMS application with separate backend and frontend deployments on different Vercel projects.

## Deployment Structure

```
hrms-v1/
├── backend/
│   ├── vercel.json          # Backend deployment config
│   ├── build_files.sh       # Backend build script
│   ├── .env.example         # Backend environment template
│   └── dashboard/
│       └── vercel_wsgi.py   # WSGI handler for Vercel
├── frontend/
│   ├── vercel.json          # Frontend deployment config
│   ├── package.json         # Frontend dependencies
│   └── .env.example         # Frontend environment template
└── vercel.json              # Root config (instruction only)
```

## Backend Deployment

### Prerequisites
- Backend code in `/backend` directory
- `backend/vercel.json` configured
- `backend/build_files.sh` executable
- Required environment variables set

### Deployment Steps

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

3. **Set Environment Variables in Vercel Dashboard:**
   - `SECRET_KEY` - Django secret key
   - `DATABASE_URL` - PostgreSQL connection string
   - `ALLOWED_HOSTS` - Comma-separated allowed hosts
   - `FRONTEND_URL` - Frontend deployment URL
   - `DEBUG` - Set to `False`
   - `FORCE_CORS_ALL_ORIGINS` - Set to `False`

### Backend Configuration Files

#### `backend/vercel.json`
```json
{
  "version": 2,
  "builds": [
    {
      "src": "dashboard/vercel_wsgi.py",
      "use": "@vercel/python",
      "config": {
        "maxLambdaSize": "15mb",
        "runtime": "python3.11"
      }
    },
    {
      "src": "build_files.sh",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "staticfiles"
      }
    }
  ],
  "routes": [
    {
      "src": "/static/(.*)",
      "dest": "/staticfiles/$1"
    },
    {
      "src": "/media/(.*)",
      "dest": "/media/$1"
    },
    {
      "src": "/(.*)",
      "dest": "dashboard/vercel_wsgi.py"
    }
  ]
}
```

## Frontend Deployment

### Prerequisites
- Frontend code in `/frontend` directory
- `frontend/vercel.json` configured
- `package.json` with build scripts
- Required environment variables set

### Deployment Steps

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

3. **Set Environment Variables in Vercel Dashboard:**
   - `VITE_API_BASE_URL` - Backend deployment URL
   - `VITE_APP_ENV` - Set to `production`

### Frontend Configuration Files

#### `frontend/vercel.json`
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/assets/(.*)",
      "dest": "/assets/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "buildCommand": "npm run build"
}
```

## Post-Deployment Configuration

### 1. Update Backend CORS Settings
After frontend deployment, update the backend's environment variables:
- Set `FRONTEND_URL` to the frontend deployment URL
- Ensure `ALLOWED_HOSTS` includes the backend domain

### 2. Update Frontend API Configuration
After backend deployment, update the frontend's environment variables:
- Set `VITE_API_BASE_URL` to the backend deployment URL

### 3. Test Cross-Origin Communication
- Verify frontend can make API calls to backend
- Check browser console for CORS errors
- Test authentication flow

## Environment Variables Reference

### Backend (.env)
```env
SECRET_KEY=your-django-secret-key
DATABASE_URL=postgresql://username:password@host:port/database
ALLOWED_HOSTS=localhost,127.0.0.1,your-backend-domain.vercel.app
FRONTEND_URL=https://your-frontend-domain.vercel.app
DEBUG=False
FORCE_CORS_ALL_ORIGINS=False
```

### Frontend (.env)
```env
VITE_API_BASE_URL=https://your-backend-domain.vercel.app
VITE_APP_ENV=production
```

## Validation Scripts

### Run Separate Deployment Validation
```bash
python validate_separate_deployments.py
```

This script validates:
- Backend deployment configuration
- Frontend deployment configuration
- Environment variable templates
- Essential deployment files

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure `FRONTEND_URL` is set correctly in backend
   - Verify `CORS_ALLOWED_ORIGINS` includes frontend URL

2. **Build Failures**
   - Check `build_files.sh` permissions
   - Verify all dependencies in `requirements.txt`
   - Ensure Python runtime version matches

3. **Static Files Not Loading**
   - Check `collectstatic` runs in build script
   - Verify static file routes in `vercel.json`

4. **Database Connection Issues**
   - Ensure `DATABASE_URL` is correctly formatted
   - Check database permissions and network access

### Logs and Debugging
- View deployment logs in Vercel dashboard
- Check function logs for runtime errors
- Use Vercel CLI for detailed debugging: `vercel logs [deployment-url]`

## Security Considerations

1. **Environment Variables**
   - Never commit `.env` files to version control
   - Use strong, unique secret keys
   - Rotate credentials regularly

2. **CORS Configuration**
   - Use specific origins in production
   - Avoid `CORS_ALLOW_ALL_ORIGINS=True` in production

3. **Database Security**
   - Use SSL connections
   - Implement proper access controls
   - Regular security updates

## Deployment Workflow

### Development to Production
1. Test locally with environment variables
2. Validate with deployment scripts
3. Deploy backend first
4. Update frontend environment with backend URL
5. Deploy frontend
6. Update backend environment with frontend URL
7. Test cross-origin functionality

### Continuous Deployment
Consider setting up GitHub Actions for automated deployments:
- Separate workflows for backend and frontend
- Environment-specific deployments
- Automated testing before deployment

## Support and Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Django Deployment Guide](https://docs.djangoproject.com/en/stable/howto/deployment/)
- [Vite Deployment Guide](https://vitejs.dev/guide/build.html)