$filePath = ".\src\utils\message-chunking\index.js"
$content = Get-Content -Path $filePath -Raw
$content = $content -replace "`r`n", "`n"
Set-Content -Path $filePath -Value $content -NoNewline
Write-Host "Line endings fixed for $filePath"
