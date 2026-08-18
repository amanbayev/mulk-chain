#Requires -Version 5.1
<#
.SYNOPSIS
  One-command local demo for Mulk Chain on Windows.

.DESCRIPTION
  Starts optional Docker infra (Postgres, Redis), Anvil, deploys contracts,
  then runs the Core Backend API and Next.js console in parallel.
  Docker is optional: without it the gateway uses in-memory queues.
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

function Resolve-CmdShim {
  param([string]$Name)
  $cmd = Get-Command "$Name.cmd" -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $exe = Get-Command $Name -ErrorAction SilentlyContinue
  if ($exe) { return $exe.Source }
  return $null
}

$script:NpmExe = Resolve-CmdShim "npm"
$script:NpxExe = Resolve-CmdShim "npx"

function Invoke-Npm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$NpmArgs)
  if (-not $script:NpmExe) {
    throw "Required command 'npm' was not found. Install Node.js >= 20."
  }
  & $script:NpmExe @NpmArgs
  if ($LASTEXITCODE -ne 0) {
    throw "npm $($NpmArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Invoke-Npx {
  param([string[]]$NpxArgs)
  if (-not $script:NpxExe) {
    throw "Required command 'npx' was not found. Install Node.js >= 20."
  }
  & $script:NpxExe @NpxArgs
  return $LASTEXITCODE
}

if (-not $script:NpmExe) {
  throw "Required command 'npm' was not found. Install Node.js >= 20. If PowerShell blocks npm.ps1, run .\demo.cmd instead."
}
Assert-Command anvil "Install Foundry: https://book.getfoundry.sh/getting-started/installation"
Assert-Command forge "Install Foundry: https://book.getfoundry.sh/getting-started/installation"

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
$useDocker = $false
if ($dockerCmd) {
  Write-Step "Checking Docker daemon"
  docker info 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $useDocker = $true
  } else {
    Write-Host "Docker is installed but the daemon is not running. Skipping Postgres/Redis (in-memory backend)." -ForegroundColor Yellow
  }
} else {
  Write-Host ""
  Write-Host "Docker Desktop not found. Skipping Postgres/Redis. API uses in-memory queues (local demo)." -ForegroundColor Yellow
  Write-Host "Optional later: install Docker Desktop and re-run to persist FIFO / DB." -ForegroundColor Yellow
}

$envFile = Join-Path $PSScriptRoot ".env"
$envExample = Join-Path $PSScriptRoot ".env.example"
if (-not (Test-Path -LiteralPath $envFile) -and (Test-Path -LiteralPath $envExample)) {
  Copy-Item -LiteralPath $envExample -Destination $envFile
  Write-Host "Created .env from .env.example"
}

if ($useDocker) {
  Write-Step "Starting Postgres and Redis (docker compose)"
  Invoke-Npm run infra:up
  Write-Host "Waiting for Postgres :5432 and Redis :6379"
  $infraWait = Invoke-Npx @("wait-on", "tcp:127.0.0.1:5432", "tcp:127.0.0.1:6379", "-t", "60000")
  if ($infraWait -ne 0) {
    throw "Timed out waiting for Docker infra (Postgres/Redis)."
  }
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
  Write-Step "Waiting for Anvil RPC tcp:127.0.0.1:8545"
  $rpcTcp = Invoke-Npx @("wait-on", "tcp:127.0.0.1:8545", "-t", "60000")
  if ($rpcTcp -ne 0) {
    throw "Timed out waiting for Anvil RPC at http://127.0.0.1:8545"
  }

  Write-Step "Deploying contracts to Anvil"
  Invoke-Npm run deploy:local

  $env:CORE_BACKEND_URL = "http://127.0.0.1:8787"
  $env:PORT = "8787"

  Write-Step "Will open http://localhost:3000 when the frontend is ready"
  Start-Process -FilePath "cmd.exe" -ArgumentList @(
    "/c",
    "npx.cmd wait-on http://127.0.0.1:3000 -t 180000 && start http://localhost:3000"
  ) -WindowStyle Hidden | Out-Null

  Write-Step "Starting Core Backend and Next.js (Ctrl+C to stop)"
  & $script:NpxExe concurrently -n backend,web -c cyan,magenta "npm.cmd run dev:backend" "npm.cmd run dev:web"
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 130) {
    throw "concurrently exited with code $LASTEXITCODE"
  }
} finally {
  if ($startedAnvil -and $null -ne $anvilProcess -and -not $anvilProcess.HasExited) {
    Write-Host "Stopping Anvil (PID $($anvilProcess.Id))"
    Stop-Process -Id $anvilProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
