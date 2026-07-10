# PowerShell setup script for Futsal Monitor

# Navigate to the project directory
Set-Location "C:\Users\olive\OneDrive - Universidade da Coruña\Documentos\New OpenCode Project\futsal-monitor"

# Add Node to PATH if not already there
if (!$env:PATH.Contains("C:\Program Files\nodejs")) {
    $env:PATH = "C:\Program Files\nodejs;" + $env:PATH
    Write-Host "Node.js added to PATH"
}

# Check if vite module exists
try {
    $viteModulePath = Join-Path $PWD "node_modules\vite\bin\vite"
    if (-Not (Test-Path $viteModulePath)) {
        Write-Error "Vite module not found!"
        Write-Host "Attempting to fix module path..."
        
        # Try to verify node installation
        if (Get-Command "node.exe" -ErrorAction SilentlyContinue) {
            Write-Host "Node is available, checking environment..."
        } else {
            Write-Host "ERROR: Node.js is not properly installed or in PATH"
            Write-Host "Please install Node.js from https://nodejs.org"
            return
        }
    }
} catch {
    Write-Error "Failed to check vite module: $($_.Exception.Message)"
}

# Check if TypeScript is available
try {
    $tscPath = Join-Path $PWD "node_modules\typescript\lib\tsc.js"
    if (-Not (Test-Path $tscPath)) {
        Write-Warning "TypeScript compilation not available"
        Write-Host "You can install it with: npm i typescript -g"
    }
} catch {
    Write-Warning "Cannot verify TypeScript: $($_.Exception.Message)"
}

# Start Vite development server
Write-Host "Starting Vite development server..."
Write-Host "Application will be available at: http://localhost:5173"
Write-Host "Default credentials:"
Write-Host "  - Password: futsal2024"
Write-Host "  - Login at: http://localhost:5173/login"
Write-Host ""
Write-Host "Press Ctrl+C to stop the server"
Write-Host ""

# Run vite dev
node modules\vite\bin\vite dev