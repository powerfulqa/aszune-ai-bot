$filePath = ".\src\utils\enhanced-message-chunker.js"
$content = Get-Content -Path $filePath -Raw
$content = $content -replace "`r`n", "`n"
Set-Content -Path $filePath -Value $content -NoNewline
Write-Host "Line endings fixed for $filePath"
