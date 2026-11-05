param([switch]$SinAbrirNavegador, [switch]$Reiniciar)
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
if ($sigfRunning -and $Reiniciar) {
    $sigfListener = Get-NetTCPConnection -LocalAddress $sigfSettings.host -LocalPort $sigfSettings.port -State Listen -ErrorAction Stop
    $sigfServerPath = Join-Path $PSScriptRoot 'servidor_documentacion.py'
    foreach ($sigfOwnerId in @($sigfListener.OwningProcess | Select-Object -Unique)) {
        $sigfOwner = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $sigfOwnerId)
        if (-not $sigfOwner.CommandLine -or
            $sigfOwner.CommandLine.IndexOf($sigfServerPath, [StringComparison]::OrdinalIgnoreCase) -lt 0 -or
            $sigfOwner.CommandLine.IndexOf($sigfConfig, [StringComparison]::OrdinalIgnoreCase) -lt 0 -or
            -not [String]::Equals($sigfOwner.ExecutablePath, $sigfPython, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'El puerto está ocupado por otro proceso. No se reinició.'
        }
        $sigfProcess = Get-Process -Id $sigfOwnerId
        Stop-Process -Id $sigfOwnerId -ErrorAction Stop
        if (-not $sigfProcess.WaitForExit(5000)) { throw 'No se pudo detener el servicio anterior.' }
    }
    $sigfRunning = $false
}
if (-not $sigfRunning) {
    $env:PYTHONPATH = Join-Path $sigfRoot '.intranet-deps'
    $sigfArguments = @('"' + (Join-Path $PSScriptRoot 'servidor_documentacion.py') + '"', '--config', '"' + $sigfConfig + '"')
    $sigfNewProcess = Start-Process -FilePath $sigfPython -ArgumentList $sigfArguments -WorkingDirectory $sigfRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $sigfRoot 'outputs/servidor-sigf.log') -RedirectStandardError (Join-Path $sigfRoot 'outputs/servidor-sigf-error.log') -PassThru
    for ($sigfAttempt = 0; $sigfAttempt -lt 30; $sigfAttempt++) {
        if ($sigfNewProcess.HasExited) { throw 'El servicio no pudo iniciarse. Revisar outputs/servidor-sigf-error.log.' }
        try { $sigfResponse = Invoke-WebRequest -Uri ($sigfAddress + '/index.html') -UseBasicParsing -TimeoutSec 1; $sigfRunning = $sigfResponse.Content -match 'SIGF'; if ($sigfRunning) { break } } catch {}
        Start-Sleep -Milliseconds 200
    }
    if (-not $sigfRunning) { throw 'El servicio no respondió a tiempo. Revisar el registro antes de reintentar.' }
}
if (-not $SinAbrirNavegador) { Start-Process $sigfAddress }
Write-Output ('SIGF: ' + $sigfAddress)
