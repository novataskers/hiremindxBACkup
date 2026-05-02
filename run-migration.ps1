# Migration setup script for community tables (Windows PowerShell)
# This script applies the missing database migrations for the community marketplace features

Write-Host "Starting database migration..." -ForegroundColor Green
Write-Host "This will add the community marketplace tables to your database" -ForegroundColor Cyan
Write-Host ""

# Check if environment variables are set
if ([string]::IsNullOrEmpty($env:TURSO_CONNECTION_URL) -or [string]::IsNullOrEmpty($env:TURSO_AUTH_TOKEN)) {
    Write-Host "ERROR: Missing environment variables" -ForegroundColor Red
    Write-Host "Please set TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN" -ForegroundColor Yellow
    exit 1
}

Write-Host "Applying migrations..." -ForegroundColor Cyan

# Run drizzle migrations
npx drizzle-kit migrate

Write-Host ""
Write-Host "Migration complete!" -ForegroundColor Green
Write-Host "The community marketplace tables have been created." -ForegroundColor Green
