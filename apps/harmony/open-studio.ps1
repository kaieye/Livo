#!/usr/bin/env pwsh

# Automatically open project in DevEco Studio
Write-Host "Opening HarmonyOS project in DevEco Studio..." -ForegroundColor Cyan
Write-Host ""

$projectPath = "E:\Livo\apps\harmony"

# Try to find DevEco Studio installation
$possiblePaths = @(
    "${env:ProgramFiles}\DevecoStudio\bin\devecostudio.exe",
    "${env:ProgramFiles(X86)}\DevecoStudio\bin\devecostudio.exe",
    "${env:LOCALAPPDATA}\Programs\DevecoStudio\bin\devecostudio.exe",
    "C:\DevecoStudio\bin\devecostudio.exe"
)

$studioPath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $studioPath = $path
        break
    }
}

if ($studioPath) {
    Write-Host "Found DevEco Studio at: $studioPath" -ForegroundColor Green
    Write-Host "Opening project..." -ForegroundColor Green
    Start-Process -FilePath $studioPath -ArgumentList $projectPath
    Write-Host "DevEco Studio is starting..." -ForegroundColor Green
} else {
    Write-Host "DevEco Studio not found automatically." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please manually:" -ForegroundColor White
    Write-Host "1. Open DevEco Studio" -ForegroundColor Gray
    Write-Host "2. Click File -> Open" -ForegroundColor Gray
    Write-Host "3. Select folder: $projectPath" -ForegroundColor Cyan
    Write-Host ""
    
    # Try to open file explorer at the project location
    Write-Host "Opening project folder in Explorer..." -ForegroundColor Green
    explorer.exe $projectPath
}

Write-Host ""
Write-Host "Next steps in DevEco Studio:" -ForegroundColor Yellow
Write-Host "1. Wait for project sync to complete" -ForegroundColor Gray
Write-Host "2. Open Device Manager (Ctrl+Alt+8)" -ForegroundColor Gray
Write-Host "3. Create or start a virtual device" -ForegroundColor Gray
Write-Host "4. Click Run button or press Shift+F10" -ForegroundColor Gray
Write-Host ""
