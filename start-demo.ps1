#Requires -Version 5.1
<#
.SYNOPSIS
  One-command local demo for Mülk Chain on Windows.

.DESCRIPTION
  Starts Docker infra (Postgres, Redis), Anvil, deploys contracts,
  then runs the Core Backend API and Next.js console in parallel.
#>
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-Command {
  param([string]$Name, [string]$Hint)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found. $Hint"
  }
}

function Test-TcpPort {
  param([int]$Port)
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $async.AsyncWaitHandle.WaitOne(400)
    $connected = $ok -and $client.Connected
    $client.Close()
    return $connected
  } catch {
    return $false
  }
}

function Invoke-Npm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$NpmArgs)
  & npm @NpmArgs
  if ($LASTEXITCODE -ne 0) {
    throw "npm $($NpmArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Invoke-Npx {
  param([string[]]$NpxArgs)
  & npx @NpxArgs
  return $LASTEXITCODE
}

Assert-Command docker "Install Docker Desktop and ensure it is running."
Assert-Command npm "Install Node.js >= 20."
Assert-Command anvil "Install Foundry: https://book.getfoundry.sh/getting-started/installation"
Assert-Command forge "Install Foundry: https://book.getfoundry.sh/getting-started/installation"

Write-Step "Checking Docker daemon"
docker info *>$null
if ($LASTEXITCODE -ne 0) {
  throw "Docker daemon is not running. Start Docker Desktop and retry."
}

$envFile = Join-Path $PSScriptRoot ".env"
$envExample = Join-Path $PSScriptRoot ".env.example"
if (-not (Test-Path -LiteralPath $envFile) -and (Test-Path -LiteralPath $envExample)) {
  Copy-Item -LiteralPath $envExample -Destination $envFile
  Write-Host "Created .env from .env.example"
}

Write-Step "Starting Postgres and Redis (docker compose)"
Invoke-Npm run infra:up
Write-Host "Waiting for Postgres :5432 and Redis :6379"
$infraWait = Invoke-Npx @("wait-on", "tcp:127.0.0.1:5432", "tcp:127.0.0.1:6379", "-t", "60000")
if ($infraWait -ne 0) {
  throw "Timed out waiting for Docker infra (Postgres/Redis)."
}

$anvilProcess = $null
$startedAnvil = $false
if (Test-TcpPort -Port 8545) {
  Write-Step "Anvil already listening on http://127.0.0.1:8545"
} else {
  Write-Step "Starting Anvil in the background"
  $logDir = Join-Path $PSScriptRoot "logs"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $anvilPath = (Get-Command anvil).Source
  $anvilProcess = Start-Process -FilePath $anvilPath `
    -ArgumentList @("--host", "127.0.0.1", "--port", "8545", "--chain-id", "31337") `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "anvil.log") `
    -RedirectStandardError (Join-Path $logDir "anvil.err.log")
  $startedAnvil = $true
  Write-Host "Anvil PID $($anvilProcess.Id) (logs/anvil.log)"
}

try {
  Write-Step "Waiting for RPC http://127.0.0.1:8545"
  $rpcHttp = Invoke-Npx @("wait-on", "http://127.0.0.1:8545", "-t", "8000")
  if ($rpcHttp -ne 0) {
    Write-Host "HTTP probe did not return 2xx (Anvil is JSON-RPC). Falling back to TCP."
    $rpcTcp = Invoke-Npx @("wait-on", "tcp:127.0.0.1:8545", "-t", "60000")
    if ($rpcTcp -ne 0) {
      throw "Timed out waiting for Anvil RPC at http://127.0.0.1:8545"
    }
  }

  Write-Step "Deploying contracts to Anvil"
  Invoke-Npm run deploy:local

  $env:CORE_BACKEND_URL = "http://127.0.0.1:8787"
  $env:PORT = "8787"

  Write-Step "Will open http://localhost:3000 when the frontend is ready"
  $openCmd = "npx wait-on http://127.0.0.1:3000 -t 180000 && start http://localhost:3000"
  Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", $openCmd) -WindowStyle Hidden | Out-Null

  Write-Step "Starting Core Backend and Next.js (Ctrl+C to stop)"
  & npx concurrently -n backend,web -c cyan,magenta "npm run dev:backend" "npm run dev:web"
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 130) {
    throw "concurrently exited with code $LASTEXITCODE"
  }
} finally {
  if ($startedAnvil -and $null -ne $anvilProcess -and -not $anvilProcess.HasExited) {
    Write-Host "Stopping Anvil (PID $($anvilProcess.Id))"
    Stop-Process -Id $anvilProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
