# Seed PSC-DRFMS with sample data and files from your Documents folder
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "Copying sample files from Documents..." -ForegroundColor Cyan
$seed = Join-Path $ProjectRoot "backend\seed_samples"
$docs = "C:\Users\USER\Documents"
New-Item -ItemType Directory -Force -Path $seed | Out-Null

$pick = @(
    "$docs\CCMS_Need_Assessment_Brief_May2026.docx",
    "$docs\Concept Note.pdf",
    "$docs\IPDU_MFiles_Technical_Assessment_May2026.docx",
    "$docs\IPDU_MFiles_Technical_Assessment_May2026.pdf",
    "$docs\Ministries_PVP_Clean.xlsx",
    "$docs\Training_Recommendations_IPDU_May2026.docx",
    "$docs\IPDU_Project_Register_NAB_May2026.docx",
    "$docs\1.png", "$docs\2.png", "$docs\3.png",
    "$docs\Brief Meeting with Compliance on Thursday this Week\CCMS_Need_Assessment_Brief_May2026.pdf",
    "$docs\Brief Meeting with Compliance on Thursday this Week\Grievance Process_2025.docx",
    "$docs\Commission Decision App\Project Overview.pdf",
    "$docs\Commission Decision App\PSC Forms Categories.xlsx",
    "$docs\Commission Decision App\Technical Design Document.pdf",
    "$docs\Commission Decision App\Concept Note - PSC Form Submission Tracker.docx"
)

$n = 0
foreach ($p in $pick) {
    if (Test-Path $p) {
        $name = [System.IO.Path]::GetFileName($p)
        $dest = Join-Path $seed $name
        if (Test-Path $dest) { $dest = Join-Path $seed ("dup_{0}_{1}" -f $n, $name) }
        Copy-Item $p $dest -Force
        $n++
    }
}
Write-Host "Copied $n files to backend/seed_samples" -ForegroundColor Green

Write-Host "Running seed in Docker..." -ForegroundColor Cyan
docker compose exec -T backend python manage.py seed_system --force

Write-Host ""
Write-Host "Done. Open http://localhost:3000 and browse documents." -ForegroundColor Green
Write-Host "  admin@psc.gov.vu / Admin@123!"
Write-Host "  reviewer@psc.gov.vu / Demo@123!  (pending workflow task)"
