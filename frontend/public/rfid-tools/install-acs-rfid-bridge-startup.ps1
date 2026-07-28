param(
  [string]$TaskName = 'AICS ACS RFID Bridge',
  [int]$Port = 17654,
  [int]$PollDelayMs = 150
)

$ErrorActionPreference = 'Stop'

$bridgePath = Join-Path $PSScriptRoot 'acs-rfid-bridge.ps1'
if (-not (Test-Path -LiteralPath $bridgePath)) {
  throw "RFID bridge script not found: $bridgePath"
}

$powershell = Join-Path $PSHOME 'powershell.exe'
$arguments = @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', "`"$bridgePath`"",
  '-Port', $Port,
  '-PollDelayMs', $PollDelayMs
) -join ' '

$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Days 365)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description 'Starts the local ACS PC/SC RFID bridge for the AICS system.' `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName

Write-Host "Installed and started scheduled task: $TaskName"
Write-Host "Bridge URL: http://127.0.0.1:$Port"
