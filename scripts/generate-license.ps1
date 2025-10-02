# Automated License Generation for Aszune AI Bot v1.6.0
# PowerShell script wrapper for easy license generation

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("personal", "community", "commercial", "enterprise")]
    [string]$Type,
    
    [Parameter(Mandatory=$false)]
    [ValidateRange(1, 100)]
    [int]$Count = 1,
    
    [Parameter(Mandatory=$false)]
    [switch]$Save,
    
    [Parameter(Mandatory=$false)]
    [string]$Email
)

Write-Host ""
Write-Host "🔑 Aszune AI Bot - License Generator v1.6.0" -ForegroundColor Cyan
Write-Host ""

# Build node command
$nodeCmd = "node scripts/generate-license.js $Type $Count"

if ($Save) {
    $nodeCmd += " --save"
}

if ($Email) {
    $nodeCmd += " --email $Email"
}

Write-Host "Running: $nodeCmd" -ForegroundColor Yellow
Write-Host ""

# Execute the command
Invoke-Expression $nodeCmd

Write-Host ""
Write-Host "✅ License generation complete!" -ForegroundColor Green

# Usage examples in help
if ($args.Count -eq 0) {
    Write-Host "Usage Examples:" -ForegroundColor Cyan
    Write-Host "  .\generate-license.ps1 -Type personal" -ForegroundColor White
    Write-Host "  .\generate-license.ps1 -Type commercial -Count 1 -Save" -ForegroundColor White
    Write-Host "  .\generate-license.ps1 -Type enterprise -Count 1 -Save -Email 'user@company.com'" -ForegroundColor White
    Write-Host ""
}