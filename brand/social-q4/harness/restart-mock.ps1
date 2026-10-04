# Stop whatever listens on the mock port and start mock-api.mjs again, detached.
# Usage: powershell -File restart-mock.ps1 [-Port 4499] [-Persona women]
param([int]$Port = 4499, [string]$Persona = 'women')
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 400
$env:PERSONA = $Persona
$p = Start-Process -FilePath 'node' -ArgumentList @('mock-api.mjs', "$Port") -WorkingDirectory $here `
  -RedirectStandardOutput (Join-Path $here 'mock.log') -RedirectStandardError (Join-Path $here 'mock.err.log') `
  -WindowStyle Hidden -PassThru
Set-Content -Path (Join-Path $here 'mock.pid') -Value $p.Id -Encoding ascii
Start-Sleep -Milliseconds 900
Write-Output "mock pid $($p.Id) on http://localhost:$Port"
Get-Content (Join-Path $here 'mock.log') -ErrorAction SilentlyContinue
Get-Content (Join-Path $here 'mock.err.log') -ErrorAction SilentlyContinue
