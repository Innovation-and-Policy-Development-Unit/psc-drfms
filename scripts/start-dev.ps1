# Start PSC-DRFMS for local development (requires Docker Desktop running)
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "PSC-DRFMS — starting services..." -ForegroundColor Cyan

# Check Docker daemon
try {
    docker info *> $null
} catch {
    Write-Host ""
    Write-Host "Docker is not running." -ForegroundColor Red
    Write-Host "1. Open Docker Desktop and wait until it says 'Engine running'"
    Write-Host "2. Run this script again: .\scripts\start-dev.ps1"
    exit 1
}

if (-not (Test-Path ".env")) {
    Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

Write-Host "Building and starting containers (first run may take several minutes)..." -ForegroundColor Yellow
docker compose up -d --build

Write-Host "Waiting for backend health..." -ForegroundColor Yellow
$healthy = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8000/api/health/" -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) { $healthy = $true; break }
    } catch { Start-Sleep -Seconds 3 }
}

if (-not $healthy) {
    Write-Host "Backend not healthy yet. Check logs:" -ForegroundColor Yellow
    Write-Host "  docker compose logs backend --tail 50"
    exit 1
}

# Reset superuser password from .env (idempotent)
docker compose exec -T backend python manage.py shell -c "from apps.accounts.fixtures import create_superuser; create_superuser()" 2>$null

Write-Host ""
Write-Host "Ready!" -ForegroundColor Green
Write-Host "  Frontend:  http://localhost:3000"
Write-Host "  API:       http://localhost:8000/api/health/"
Write-Host "  API docs:  http://localhost:8000/api/docs/"
Write-Host "  Admin:     http://localhost:8000/admin/"
Write-Host ""
Write-Host "Login (frontend):" -ForegroundColor Cyan
Write-Host "  Email:    admin@psc.gov.vu"
Write-Host "  Password: Admin@123!"
Write-Host ""
