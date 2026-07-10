# Find vite executable in node_modules
function Find-VitePath() {
    $vitePaths = Get-ChildItem "node_modules" -Recurse -Include "vite.ps1", "vite.cmd", "vite" -ErrorAction SilentlyContinue
    
    if ($vitePaths) {
        # Find the closest/lowest level vite executable
        $vitePath = $vitePaths | Sort-Object Length | Select-Object -First 1
        return $vitePath.FullName
    }
    
    return $null
}

# Navigate to project
Set-Location "C:\Users\olive\OneDrive - Universidade da Coruña\Documentos\New OpenCode Project\futsal-monitor"

# Find vite
$vitePath = Find-VitePath
if (-Not $vitePath) {
    Write-Host "Vite executable not found in node_modules" -ForegroundColor Red
    Write-Host "Please check if the project has been properly installed" -ForegroundColor Yellow
    return
}

Write-Host "Found Vite at: $vitePath" -ForegroundColor Green

# Run vite
& $vitePath -Wait
