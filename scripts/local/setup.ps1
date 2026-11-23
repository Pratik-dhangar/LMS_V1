[CmdletBinding()]
param(
    [ValidateSet('Setup', 'Start', 'Stop', 'Status', 'Logs', 'Check')]
    [string]$Action = 'Setup',
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$RepoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$StateDir = Join-Path $RepoRoot '.local-setup'
$StateFile = Join-Path $StateDir 'native.json'
$DataDir = Join-Path $StateDir 'postgres-data'
$Backend = Join-Path $RepoRoot 'hurshbintech-backend'
$Frontend = Join-Path $RepoRoot 'hurshbintech-frontend'
$Python = Join-Path $Backend '.venv/Scripts/python.exe'
$Utf8 = New-Object Text.UTF8Encoding $false

function Invoke-Checked([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed (exit $LASTEXITCODE): $Exe. See the output above." }
}

function Write-Utf8([string]$Path, [string[]]$Lines) {
    [IO.File]::WriteAllLines($Path, $Lines, $script:Utf8)
}

function Save-State { Write-Utf8 $StateFile @($script:State | ConvertTo-Json -Depth 5) }

function Refresh-Path {
    $env:PATH = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
        [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + $env:PATH
}

function Install-Package([string]$Id) {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) { throw "Install Microsoft App Installer (winget), or install $Id manually, then rerun." }
    Write-Host "Installing $Id. Windows may request administrator approval."
    Invoke-Checked $winget.Source @('install', '--id', $Id, '--exact', '--source', 'winget', '--accept-source-agreements', '--accept-package-agreements')
    Refresh-Path
}

function Get-BasePython {
    $candidates = @()
    $command = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($command -and $command.Source -notlike '*WindowsApps*') { $candidates += $command.Source }
    foreach ($version in @('312', '311')) {
        $candidates += "$env:LOCALAPPDATA/Programs/Python/Python$version/python.exe"
        $candidates += "$env:ProgramFiles/Python$version/python.exe"
    }
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (Test-Path -LiteralPath $candidate) {
            & $candidate -c 'import sys; sys.exit(0 if (3,11) <= sys.version_info[:2] <= (3,12) and sys.maxsize > 2**32 else 1)'
            if ($LASTEXITCODE -eq 0) { return $candidate }
        }
    }
    return $null
}

function Find-PgBin {
    if (Test-Path -LiteralPath $StateFile) {
        $saved = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
        if ($saved.PgBin -and (Test-Path -LiteralPath (Join-Path $saved.PgBin 'initdb.exe'))) { return $saved.PgBin }
        if (Test-Path -LiteralPath (Join-Path $DataDir 'PG_VERSION')) {
            throw 'The original PostgreSQL binaries are missing. Restore the same major version; the existing cluster will not be reinitialized.'
        }
    }
    $candidates = @((Join-Path $StateDir 'tools/postgresql/pgsql/bin'), "$env:ProgramFiles/PostgreSQL/15/bin")
    $command = Get-Command initdb.exe -ErrorAction SilentlyContinue
    if ($command) { $candidates += Split-Path -Parent $command.Source }
    foreach ($candidate in $candidates) {
        if ((Test-Path -LiteralPath (Join-Path $candidate 'initdb.exe')) -and
            (Test-Path -LiteralPath (Join-Path $candidate 'pg_ctl.exe'))) { return $candidate }
    }
    return $null
}

function Install-PortablePostgres {
    # Resolve the latest 15.x archive from PostgreSQL's linked Windows distributor.
    Write-Host 'Locating the current PostgreSQL 15 Windows binary archive from EDB...'
    $page = Invoke-WebRequest 'https://www.enterprisedb.com/download-postgresql-binaries' -UseBasicParsing -TimeoutSec 45
    $plain = [regex]::Replace($page.Content, '<[^>]+>', ' ')
    $versions = [regex]::Matches($plain, 'Version\s+(15\.\d+)') | ForEach-Object { $_.Groups[1].Value }
    $version = $versions | Sort-Object { [version]$_ } -Descending | Select-Object -First 1
    if (-not $version) { throw 'Could not resolve PostgreSQL 15 from EDB. Install PostgreSQL 15 manually from https://www.postgresql.org/download/windows/ and rerun.' }
    $url = $null
    foreach ($revision in 5..1) {
        $candidate = "https://get.enterprisedb.com/postgresql/postgresql-$version-$revision-windows-x64-binaries.zip"
        Write-Host "Checking PostgreSQL $version archive revision $revision..."
        try {
            $response = Invoke-WebRequest $candidate -Method Head -UseBasicParsing -TimeoutSec 20
            if ($response.StatusCode -eq 200) { $url = $candidate; break }
        } catch { if ($revision -eq 1) { throw 'EDB archive unavailable. Install PostgreSQL 15 manually from postgresql.org and rerun.' } }
    }
    if (-not $url) { throw 'No PostgreSQL 15 Windows archive was found on EDB.' }
    $tools = Join-Path $StateDir 'tools'
    New-Item -ItemType Directory -Path $tools -Force | Out-Null
    $archive = Join-Path $tools 'postgresql.zip'
    Write-Host "Downloading PostgreSQL $version (this may take several minutes)..."
    Invoke-WebRequest $url -OutFile $archive -UseBasicParsing -TimeoutSec 1800
    Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $tools 'postgresql') -Force
    [IO.File]::Delete($archive)
    $bin = Join-Path $tools 'postgresql/pgsql/bin'
    Invoke-Checked (Join-Path $bin 'initdb.exe') @('--version') | Out-Host
    return $bin
}

function New-Secret([int]$Count, [switch]$Base64) {
    $bytes = New-Object byte[] $Count
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    if ($Base64) { return [Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_') }
    return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

function Test-Port([int]$Port) {
    $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $Port)
    try { $listener.Start(); return $true } catch { return $false }
    finally { $listener.Stop() }
}

function Initialize-Config([string]$PgBin) {
    if (Test-Path -LiteralPath $StateFile) {
        $script:State = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
        if (-not $script:State.DbPassword -or -not $script:State.EncryptionKey -or
            -not $script:State.SecretKey -or -not $script:State.PgPort -or -not $script:State.AdminPasscode) {
            throw 'Incomplete native.json. Restore the original configuration; keys will not be regenerated.'
        }
    } else {
        if (Test-Path -LiteralPath $DataDir) { throw 'PostgreSQL data exists without native.json. Restore the original configuration; no new keys were generated.' }
        $port = 5432
        while (-not (Test-Port $port)) { $port++; if ($port -gt 5499) { throw 'No available local PostgreSQL port.' } }
        $script:State = [pscustomobject]@{
            PgBin = $PgBin; PgPort = $port; DbPassword = (New-Secret 24)
            SecretKey = (New-Secret 32); EncryptionKey = (New-Secret 32 -Base64)
            AdminPasscode = ([int]::Parse((New-Secret 3), [Globalization.NumberStyles]::HexNumber) % 900000 + 100000).ToString()
            BackendProcess = $null; FrontendProcess = $null
        }
        Save-State
    }
    $backendEnv = Join-Path $StateDir 'backend.env'
    if (-not (Test-Path -LiteralPath $backendEnv)) {
        Write-Utf8 $backendEnv @(
            'ENVIRONMENT=development',
            "DATABASE_URL=postgresql://lms_local:$($script:State.DbPassword)@127.0.0.1:$($script:State.PgPort)/hurshbintech_pwa",
            "DB_PORT=$($script:State.PgPort)", "DB_PASSWORD=$($script:State.DbPassword)",
            "SECRET_KEY=$($script:State.SecretKey)", "ENCRYPTION_KEY=$($script:State.EncryptionKey)",
            'ACCESS_TOKEN_EXPIRE_MINUTES=1440', 'FRONTEND_URL=http://localhost:3000',
            'BACKEND_CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]',
            'USE_S3=false', 'RECORDING_STORAGE_MODE=local', 'REDIS_ENABLED=false',
            'ENABLE_EMAIL=false', 'ENABLE_TWILIO_WHATSAPP=false'
        )
    }
    $frontendEnv = Join-Path $StateDir 'frontend.env'
    if (-not (Test-Path -LiteralPath $frontendEnv)) {
        Write-Utf8 $frontendEnv @('VITE_API_BASE_URL=http://localhost:8000/api', 'VITE_WS_URL=ws://localhost:8000', 'VITE_API_TIMEOUT=10000', 'VITE_ENABLE_PWA=false', 'VITE_GOOGLE_CLIENT_ID=')
    }
}

function Import-Env([string]$File) {
    foreach ($line in [IO.File]::ReadAllLines($File)) {
        if ($line -match '^([A-Z][A-Z0-9_]*)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process') }
    }
}

function Get-OwnedProcess($Record) {
    if (-not $Record) { return $null }
    $process = Get-Process -Id $Record.Id -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime.ToUniversalTime().Ticks.ToString() -eq $Record.StartTicks) { return $process }
    return $null
}

function Test-DatabaseRunning {
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & (Join-Path $script:State.PgBin 'pg_ctl.exe') status -D $DataDir *> $null
        return $LASTEXITCODE -eq 0
    } finally { $ErrorActionPreference = $previousPreference }
}

function Stop-AppProcesses {
    foreach ($key in @('FrontendProcess', 'BackendProcess')) {
        $process = Get-OwnedProcess $script:State.$key
        if ($process) { Stop-Process -Id $process.Id; $process.WaitForExit(10000) | Out-Null }
        $script:State.$key = $null
    }
    Save-State
}

function Start-Database {
    $pg = $script:State.PgBin
    $versionFile = Join-Path $DataDir 'PG_VERSION'
    if (Test-Path -LiteralPath $versionFile) {
        $clusterMajor = [IO.File]::ReadAllText($versionFile).Trim()
        $binaryVersion = & (Join-Path $pg 'postgres.exe') --version
        if ($LASTEXITCODE -ne 0 -or $binaryVersion -notmatch ('\b' + [regex]::Escape($clusterMajor) + '\.')) {
            throw 'PostgreSQL binaries do not match the existing cluster major version. Restore matching binaries; data was not changed.'
        }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $DataDir 'PG_VERSION'))) {
        if (Test-Path -LiteralPath $DataDir) {
            if (Get-ChildItem -LiteralPath $DataDir -Force | Select-Object -First 1) { throw 'An incomplete PostgreSQL cluster exists. Inspect postgres-data before retrying; it will not be deleted.' }
        }
        $pwFile = Join-Path $StateDir 'initdb-password.tmp'
        try {
            Write-Utf8 $pwFile @($script:State.DbPassword)
            Invoke-Checked (Join-Path $pg 'initdb.exe') @('-D', $DataDir, '-U', 'lms_local', '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C', "--pwfile=$pwFile")
        } finally { if (Test-Path -LiteralPath $pwFile) { [IO.File]::Delete($pwFile) } }
    }
    if (-not (Test-DatabaseRunning)) {
        Invoke-Checked (Join-Path $pg 'pg_ctl.exe') @('start', '-D', $DataDir, '-l', (Join-Path $StateDir 'postgres.log'), '-o', "-h 127.0.0.1 -p $($script:State.PgPort)", '-w', '-t', '60')
    }
}

function Start-App([string]$Exe, [string[]]$Arguments, [string]$WorkingDir, [string]$Name) {
    $process = Start-Process -FilePath $Exe -ArgumentList $Arguments -WorkingDirectory $WorkingDir -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $StateDir "$Name.log") -RedirectStandardError (Join-Path $StateDir "$Name-error.log")
    return [pscustomobject]@{ Id = $process.Id; StartTicks = $process.StartTime.ToUniversalTime().Ticks.ToString() }
}

function Wait-Http([string]$Url, [int]$Seconds = 90) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        try { return Invoke-RestMethod $Url -TimeoutSec 3 } catch { Start-Sleep -Seconds 2 }
    } while ((Get-Date) -lt $deadline)
    throw "Application did not become ready: $Url. Check setup-local.bat Logs."
}

try {
    Set-Location -LiteralPath $RepoRoot
    Write-Host "Native Windows LMS: $Action (Docker is not used)"
    if ($Action -eq 'Check') {
        $basePython = Get-BasePython
        $node = Get-Command node.exe -ErrorAction SilentlyContinue
        $ffmpeg = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
        Write-Host "Python 3.11/3.12: $basePython"
        if ($node) { Invoke-Checked $node.Source @('--version') } else { Write-Host 'Node: not installed' }
        Write-Host "PostgreSQL binaries: $(Find-PgBin)"
        Write-Host "FFmpeg installed: $([bool]$ffmpeg)"
        Write-Host "Project virtual environment exists: $(Test-Path -LiteralPath $Python)"
        Write-Host 'Check finished. Nothing was installed or started.'
        exit 0
    }
    if ($Action -in @('Stop', 'Status', 'Logs')) {
        if (-not (Test-Path -LiteralPath $StateFile)) { Write-Host 'Native setup has not been run.'; exit 0 }
        $script:State = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
        if ($Action -eq 'Logs') {
            Get-ChildItem -LiteralPath $StateDir -Filter '*.log' | ForEach-Object { Write-Host "--- $($_.Name) ---"; Get-Content -LiteralPath $_.FullName -Tail 40 }
        } elseif ($Action -eq 'Status') {
            Write-Host "Backend running: $([bool](Get-OwnedProcess $script:State.BackendProcess))"
            Write-Host "Frontend running: $([bool](Get-OwnedProcess $script:State.FrontendProcess))"
            Invoke-Checked (Join-Path $script:State.PgBin 'pg_ctl.exe') @('status', '-D', $DataDir)
        } else {
            Stop-AppProcesses
            if (Test-DatabaseRunning) { Invoke-Checked (Join-Path $script:State.PgBin 'pg_ctl.exe') @('stop', '-D', $DataDir, '-m', 'fast', '-w') }
            Write-Host 'Stopped native application and its own database. Data is preserved.'
        }
        exit 0
    }
    New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
    $basePython = Get-BasePython
    if (-not $basePython) { Install-Package 'Python.Python.3.12'; $basePython = Get-BasePython }
    if (-not $basePython) { throw 'Python 3.12 is not discoverable after installation. Reopen the terminal and retry.' }
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    $nodeOk = $false
    if ($node) {
        & $node.Source -e 'const [a,b]=process.versions.node.split(String.fromCharCode(46)).map(Number);process.exit((a===20&&b>=19)||(a===22&&b>=12)||a>=24?0:1)'
        $nodeOk = $LASTEXITCODE -eq 0
    }
    if (-not $nodeOk) { Install-Package 'OpenJS.NodeJS.LTS'; $node = Get-Command node.exe -ErrorAction Stop }
    if (-not (Get-Command ffmpeg.exe -ErrorAction SilentlyContinue)) { Install-Package 'Gyan.FFmpeg' }
    Invoke-Checked (Get-Command ffmpeg.exe -ErrorAction Stop).Source @('-version')
    $pgBin = Find-PgBin
    if (-not $pgBin) { $pgBin = Install-PortablePostgres }
    Initialize-Config $pgBin
    Import-Env (Join-Path $StateDir 'backend.env')
    $expectedUrl = "postgresql://lms_local:$($script:State.DbPassword)@127.0.0.1:$($script:State.PgPort)/hurshbintech_pwa"
    if ($env:DATABASE_URL -cne $expectedUrl -or $env:DB_PASSWORD -cne $script:State.DbPassword -or
        $env:DB_PORT -ne $script:State.PgPort.ToString() -or $env:ENCRYPTION_KEY -cne $script:State.EncryptionKey) {
        throw 'backend.env no longer matches this setup-owned database and encryption key. Restore its original connection values; no migrations were run.'
    }
    $env:ENVIRONMENT = 'development'
    $env:PYTHONPATH = $Backend
    $env:LOCAL_ADMIN_EMAIL = 'lms-admin@example.test'
    $env:LOCAL_ADMIN_PASSCODE = $script:State.AdminPasscode
    Stop-AppProcesses
    foreach ($port in @(3000, 8000)) { if (-not (Test-Port $port)) { throw "Port $port is occupied by another application. Stop that application and retry." } }
    if (-not (Test-Path -LiteralPath $Python)) { Invoke-Checked $basePython @('-m', 'venv', (Join-Path $Backend '.venv')) }
    Set-Location -LiteralPath $Backend
    Invoke-Checked $Python @('-m', 'pip', 'install', '--upgrade', 'pip')
    Invoke-Checked $Python @('-m', 'pip', 'install', '-r', 'requirements.txt', 'APScheduler<4', 'pydantic<3', 'pydantic-settings<3')
    Invoke-Checked $Python @('-m', 'pip', 'check')
    Start-Database
    Invoke-Checked $Python @((Join-Path $PSScriptRoot 'prepare_database.py'))
    Invoke-Checked $Python @('-m', 'alembic', 'upgrade', 'head')
    Invoke-Checked $Python @((Join-Path $PSScriptRoot 'bootstrap.py'))
    Set-Location -LiteralPath $Frontend
    $npm = Get-Command npm.cmd -ErrorAction Stop
    Invoke-Checked $npm.Source @('ci', '--legacy-peer-deps', '--no-audit', '--no-fund')
    $script:State.BackendProcess = Start-App $Python @('-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000') $Backend 'backend'
    Save-State
    $health = Wait-Http 'http://localhost:8000/api/health'
    if ($health.database.status -ne 'healthy') { throw 'Backend started but database health failed.' }
    Import-Env (Join-Path $StateDir 'frontend.env')
    $vite = Join-Path $Frontend 'node_modules/vite/bin/vite.js'
    $script:State.FrontendProcess = Start-App $node.Source @(('"' + $vite + '"'), '--host', '127.0.0.1', '--port', '3000', '--strictPort') $Frontend 'frontend'
    Save-State
    $null = Wait-Http 'http://localhost:3000'
    $login = @{ role = 'admin'; passcode = $script:State.AdminPasscode } | ConvertTo-Json
    $auth = Invoke-RestMethod 'http://localhost:8000/api/auth/user/login' -Method Post -ContentType 'application/json' -Body $login -TimeoutSec 30
    if (-not $auth.access_token) { throw 'Administrator login check failed.' }
    Write-Host 'Setup complete. Database, frontend, and admin authentication checks passed.'
    Write-Host 'Frontend: http://localhost:3000    API docs: http://localhost:8000/docs'
    Write-Host "Login role: Admin    Passcode: $($script:State.AdminPasscode)"
    Write-Host 'Private configuration and logs: .local-setup/'
    if (-not $NoBrowser) { Start-Process 'http://localhost:3000' }
    exit 0
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Fix the issue and rerun setup-local.bat. Local data and credentials are preserved.'
    Write-Host 'Logs: setup-local.bat Logs'
    exit 1
}
