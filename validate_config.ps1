# HRMS Configuration Validator - PowerShell Version
# This script validates environment configuration for Windows users

Write-Host "🚀 HRMS Configuration Validator" -ForegroundColor Green
Write-Host "=" * 50

function Test-BackendConfig {
    Write-Host "🔍 Checking Backend Configuration..." -ForegroundColor Blue
    
    $backendEnvPath = Join-Path $PSScriptRoot "backend\.env"
    
    if (-not (Test-Path $backendEnvPath)) {
        Write-Host "❌ Backend .env file not found!" -ForegroundColor Red
        Write-Host "   Expected: $backendEnvPath" -ForegroundColor Yellow
        return $false
    }
    
    try {
        $envContent = Get-Content $backendEnvPath
        $envVars = @{}
        
        foreach ($line in $envContent) {
            $line = $line.Trim()
            if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
                $parts = $line.Split('=', 2)
                $envVars[$parts[0].Trim()] = $parts[1].Trim()
            }
        }
        
        $requiredVars = @('SECRET_KEY', 'DEBUG', 'FRONTEND_URL')
        $missingVars = @()
        
        foreach ($var in $requiredVars) {
            if (-not $envVars.ContainsKey($var) -or -not $envVars[$var]) {
                $missingVars += $var
            }
        }
        
        if ($missingVars.Count -gt 0) {
            Write-Host "❌ Missing backend variables: $($missingVars -join ', ')" -ForegroundColor Red
            return $false
        }
        
        Write-Host "✅ Backend configuration looks good!" -ForegroundColor Green
        Write-Host "   DEBUG: $($envVars['DEBUG'])" -ForegroundColor Gray
        Write-Host "   FRONTEND_URL: $($envVars['FRONTEND_URL'])" -ForegroundColor Gray
        
        return $true
    }
    catch {
        Write-Host "❌ Error reading backend .env file: $_" -ForegroundColor Red
        return $false
    }
}

function Test-FrontendConfig {
    Write-Host "`n🔍 Checking Frontend Configuration..." -ForegroundColor Blue
    
    $frontendEnvPath = Join-Path $PSScriptRoot "frontend\.env"
    
    if (-not (Test-Path $frontendEnvPath)) {
        Write-Host "❌ Frontend .env file not found!" -ForegroundColor Red
        Write-Host "   Expected: $frontendEnvPath" -ForegroundColor Yellow
        return $false
    }
    
    try {
        $envContent = Get-Content $frontendEnvPath
        $envVars = @{}
        
        foreach ($line in $envContent) {
            $line = $line.Trim()
            if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
                $parts = $line.Split('=', 2)
                $envVars[$parts[0].Trim()] = $parts[1].Trim()
            }
        }
        
        $apiUrl = $envVars['VITE_API_BASE_URL']
        if (-not $apiUrl) {
            Write-Host "⚠️ VITE_API_BASE_URL not set (will use auto-detection)" -ForegroundColor Yellow
        } else {
            Write-Host "✅ API URL configured: $apiUrl" -ForegroundColor Green
        }
        
        $debug = $envVars['VITE_ENABLE_DEBUG']
        if (-not $debug) { $debug = 'false' }
        Write-Host "   Debug mode: $debug" -ForegroundColor Gray
        
        return $true
    }
    catch {
        Write-Host "❌ Error reading frontend .env file: $_" -ForegroundColor Red
        return $false
    }
}

function Test-CorsCompatibility {
    Write-Host "`n🔍 Checking CORS Compatibility..." -ForegroundColor Blue
    
    try {
        $backendEnvPath = Join-Path $PSScriptRoot "backend\.env"
        $frontendEnvPath = Join-Path $PSScriptRoot "frontend\.env"
        
        $backendVars = @{}
        $frontendVars = @{}
        
        if (Test-Path $backendEnvPath) {
            $envContent = Get-Content $backendEnvPath
            foreach ($line in $envContent) {
                $line = $line.Trim()
                if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
                    $parts = $line.Split('=', 2)
                    $backendVars[$parts[0].Trim()] = $parts[1].Trim()
                }
            }
        }
        
        if (Test-Path $frontendEnvPath) {
            $envContent = Get-Content $frontendEnvPath
            foreach ($line in $envContent) {
                $line = $line.Trim()
                if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
                    $parts = $line.Split('=', 2)
                    $frontendVars[$parts[0].Trim()] = $parts[1].Trim()
                }
            }
        }
        
        $frontendUrl = $backendVars['FRONTEND_URL']
        $apiUrl = $frontendVars['VITE_API_BASE_URL']
        
        if ($frontendUrl -and $apiUrl) {
            Write-Host "   Backend expects frontend at: $frontendUrl" -ForegroundColor Gray
            Write-Host "   Frontend will call API at: $apiUrl" -ForegroundColor Gray
            Write-Host "✅ CORS configuration can be verified manually" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Could not verify CORS configuration - URLs not fully set" -ForegroundColor Yellow
        }
        
        return $true
    }
    catch {
        Write-Host "❌ Error checking CORS compatibility: $_" -ForegroundColor Red
        return $false
    }
}

# Main execution
$backendOk = Test-BackendConfig
$frontendOk = Test-FrontendConfig
$corsOk = Test-CorsCompatibility

Write-Host "`n$('=' * 50)"

if ($backendOk -and $frontendOk -and $corsOk) {
    Write-Host "✅ All configurations look good!" -ForegroundColor Green
    Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
    Write-Host "   1. Start the backend: cd backend && python manage.py runserver" -ForegroundColor Gray
    Write-Host "   2. Start the frontend: cd frontend && npm run dev" -ForegroundColor Gray
    Write-Host "   3. Check browser console for any connection errors" -ForegroundColor Gray
} else {
    Write-Host "❌ Some configurations need attention!" -ForegroundColor Red
    Write-Host "`n📋 Fix the issues above and run this script again." -ForegroundColor Yellow
    exit 1
}