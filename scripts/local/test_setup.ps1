# Exercise setup's state handling without installing packages or launching services.
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'setup.ps1'
$errors = $null
$tokens = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$errors)
if ($errors) { throw ($errors | Out-String) }
$functions = $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] }, $false)
foreach ($function in $functions) { . ([scriptblock]::Create($function.Extent.Text)) }
$Utf8 = New-Object Text.UTF8Encoding $false
$testDir = Join-Path ([IO.Path]::GetTempPath()) ("lms native's test " + [guid]::NewGuid().ToString('N'))
$StateDir = $testDir
$StateFile = Join-Path $StateDir 'native.json'
$DataDir = Join-Path $StateDir 'postgres-data'
New-Item -ItemType Directory -Path $StateDir | Out-Null
function Assert($Condition, $Message) { if (-not $Condition) { throw $Message } }
try {
    Initialize-Config 'C:/fake-postgres/bin'
    $before = [IO.File]::ReadAllText($StateFile)
    Assert ($script:State.AdminPasscode -match '^\d{6}$') 'Invalid passcode'
    $key = $script:State.EncryptionKey.Replace('-', '+').Replace('_', '/')
    Assert ([Convert]::FromBase64String($key).Length -eq 32) 'Invalid Fernet key'
    $backendFile = Join-Path $StateDir 'backend.env'
    [IO.File]::AppendAllText($backendFile, "# preserve this existing setting`n", $Utf8)
    Initialize-Config 'C:/different-postgres/bin'
    Assert ([IO.File]::ReadAllText($StateFile) -eq $before) 'Rerun changed credentials'
    Assert ([IO.File]::ReadAllText($backendFile).Contains('# preserve this')) 'Rerun overwrote environment'
    $current = Get-Process -Id $PID
    $record = [pscustomobject]@{ Id = $PID; StartTicks = $current.StartTime.ToUniversalTime().Ticks.ToString() }
    Assert ([bool](Get-OwnedProcess $record)) 'Owned-process identity check failed'
    $record.StartTicks = '1'
    Assert (-not (Get-OwnedProcess $record)) 'Reused PID would target an unrelated process'
    [IO.File]::Delete($StateFile)
    New-Item -ItemType Directory -Path $DataDir | Out-Null
    $refused = $false
    try { Initialize-Config 'C:/fake-postgres/bin' } catch { $refused = $_.Exception.Message.Contains('no new keys') }
    Assert $refused 'Lost credentials did not block cluster reuse'
    Write-Host 'Native setup tests passed: credential generation, rerun preservation, process identity, missing-key protection.'
} finally {
    # Delete only the exact files/empty directories created by this test.
    foreach ($name in @('native.json', 'backend.env', 'frontend.env')) {
        $file = Join-Path $testDir $name
        if (Test-Path -LiteralPath $file) { [IO.File]::Delete($file) }
    }
    if (Test-Path -LiteralPath $DataDir) { [IO.Directory]::Delete($DataDir) }
    [IO.Directory]::Delete($testDir)
}
