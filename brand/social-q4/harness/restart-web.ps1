# Stop whatever listens on the web port and start the Expo web dev server detached,
# pointed at the mock API (process env beats mobile/.env.development.local — no file edit).
# Usage: powershell -File restart-web.ps1 [-Port 8085] [-Api http://localhost:4499] [-Clear]
param([int]$Port = 8085, [string]$Api = 'http://localhost:4499', [switch]$Clear)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = 'C:\Users\User\Desktop\www.medicard'
Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 500
$env:EXPO_PUBLIC_API_URL = $Api
$env:BROWSER = 'none'
Remove-Item Env:CI -ErrorAction SilentlyContinue
$cli = Join-Path $repo 'mobile\node_modules\expo\bin\cli'
$argList = @("`"$cli`"", 'start', '--web', '--port', "$Port")
if ($Clear) { $argList += '--clear' }
$p = Start-Process -FilePath 'node' -ArgumentList $argList -WorkingDirectory (Join-Path $repo 'mobile') `
  -RedirectStandardOutput (Join-Path $here 'web.log') -RedirectStandardError (Join-Path $here 'web.err.log') `
  -WindowStyle Hidden -PassThru
Set-Content -Path (Join-Path $here 'web.pid') -Value $p.Id -Encoding ascii
Write-Output "expo web pid $($p.Id) on http://localhost:$Port (API $Api)"
