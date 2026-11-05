param([switch]$SinAbrirNavegador)
$ErrorActionPreference = 'Stop'
$sigfRoot = Split-Path -Parent $PSScriptRoot
$sigfConfig = Join-Path $sigfRoot 'config-documentacion.local.json'
if (-not (Test-Path -LiteralPath $sigfConfig)) { throw 'Falta config-documentacion.local.json.' }
$sigfPython = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
if (-not (Test-Path -LiteralPath $sigfPython)) {
    $sigfPythonCommand = Get-Command python.exe -ErrorAction Stop
    $sigfPython = $sigfPythonCommand.Source
}
$sigfSettings = Get-Content -LiteralPath $sigfConfig -Raw -Encoding utf8 | ConvertFrom-Json
$sigfAddress = 'http://' + $sigfSettings.host + ':' + $sigfSettings.port
$sigfRunning = $false
try { $sigfResponse = Invoke-WebRequest -Uri ($sigfAddress + '/index.html') -UseBasicParsing -TimeoutSec 3; $sigfRunning = $sigfResponse.Content -match 'SIGF' } catch {}
if (-not $sigfRunning) {
    $env:PYTHONPATH = Join-Path $sigfRoot '.intranet-deps'
    $sigfArguments = @('"' + (Join-Path $PSScriptRoot 'servidor_documentacion.py') + '"', '--config', '"' + $sigfConfig + '"')
    Start-Process -FilePath $sigfPython -ArgumentList $sigfArguments -WorkingDirectory $sigfRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $sigfRoot 'outputs/servidor-sigf.log') -RedirectStandardError (Join-Path $sigfRoot 'outputs/servidor-sigf-error.log') | Out-Null
}
if (-not $SinAbrirNavegador) { Start-Process $sigfAddress }
Write-Output ('SIGF: ' + $sigfAddress)
