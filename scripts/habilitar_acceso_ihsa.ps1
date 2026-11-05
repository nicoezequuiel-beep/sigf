# Ejecutar como administrador en la PC que aloja SIGF.
$ErrorActionPreference = 'Stop'
$sigfCorporateIp = '10.254.253.94'
$sigfCorporateInterface = 'Ethernet 3'
$sigfProfile = Get-NetConnectionProfile -InterfaceAlias $sigfCorporateInterface
if ($sigfProfile.NetworkCategory -ne 'DomainAuthenticated') { throw 'La interfaz indicada no está conectada al dominio corporativo.' }
if (-not (Get-NetIPAddress -InterfaceAlias $sigfCorporateInterface -AddressFamily IPv4 | Where-Object {$_.IPAddress -eq $sigfCorporateIp})) { throw 'La IP corporativa cambió. Revisar la configuración antes de habilitar acceso.' }
$sigfPython = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
if (-not (Test-Path -LiteralPath $sigfPython)) { $sigfPython = (Get-Command python.exe -ErrorAction Stop).Source }
if (Get-NetFirewallRule -DisplayName 'SIGF Documentacion IHSA' -ErrorAction SilentlyContinue) { throw 'Ya existe una regla SIGF. Revisarla antes de modificarla.' }
New-NetFirewallRule -DisplayName 'SIGF Documentacion IHSA' -Direction Inbound -Action Allow -Profile Domain -Protocol TCP -LocalAddress $sigfCorporateIp -LocalPort 8765 -RemoteAddress '10.0.0.0/8' -InterfaceAlias $sigfCorporateInterface -Program $sigfPython
