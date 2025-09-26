# Vercel Deployment Instructions

## Prerequisites

1. Create a Vercel account
2. Set up a cloud database (Neon, Supabase, or AWS RDS)
3. Have your frontend repository ready

## Deployment Steps

### 1. Environment Variables

Set these in your Vercel dashboard for backend (hrms-v1-64ls.vercel.app):

```
# Django Configuration
SECRET_KEY=your-secret-key
DEBUG=False
VERCEL=1
FORCE_HTTPS=1
ALLOWED_HOSTS=hrms-v1-64ls.vercel.app

# Database Configuration
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_HOST=your-db-host
DB_PORT=5432

# Frontend URL Configuration (New!)
FRONTEND_URL=https://hrms-v1-x4vi.vercel.app
ADDITIONAL_FRONTEND_URLS=https://your-custom-domain.com
FORCE_CORS_ALL_ORIGINS=False

# Email Configuration (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-email-password
```

### 2. Frontend Configuration

The frontend now uses environment variables for API configuration. Set these in your Vercel dashboard for frontend (hrms-v1-x4vi.vercel.app):

```
VITE_API_BASE_URL=https://hrms-v1-64ls.vercel.app
VITE_APP_NAME=HRMS Dashboard
VITE_ENABLE_DEBUG=false
VITE_ENABLE_ANALYTICS=true
```

**No more hardcoded URLs!** The frontend will automatically:
1. Use `VITE_API_BASE_URL` if set
2. Fall back to development URLs for localhost
3. Auto-detect production URLs if needed

### 3. Database Setup

- Use a cloud PostgreSQL database
- Run migrations after deployment:
  ```bash
  python manage.py migrate
  python manage.py createsuperuser
  ```

### 4. Deploy

1. Push code to GitHub
2. Connect repository to Vercel
3. Deploy with automatic builds

## API Endpoints

Your Django API will be available at: https://hrms-v1-64ls.vercel.app/api/

## Post-Deployment

1. Test all API endpoints from frontend
2. Verify HTTPS enforcement
3. Check CORS configuration between:
   - Frontend: https://hrms-v1-x4vi.vercel.app
   - Backend: https://hrms-v1-64ls.vercel.app
4. Test file uploads (if any)

## Troubleshooting

- Check Vercel function logs for errors
- Ensure all environment variables are set
- Verify database connectivity
- Test CORS by checking browser console for any blocked requests
- Test with Vercel CLI locally first
