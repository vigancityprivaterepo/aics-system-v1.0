param(
  [int]$Port = 17654,
  [int]$PollDelayMs = 150
)

$ErrorActionPreference = 'Stop'

$code = @"
using System;
using System.Runtime.InteropServices;

public static class PcscBridge {
  [StructLayout(LayoutKind.Sequential)]
  public struct SCARD_IO_REQUEST {
    public uint dwProtocol;
    public uint cbPciLength;
  }

  [DllImport("winscard.dll")]
  public static extern int SCardEstablishContext(uint dwScope, IntPtr pvReserved1, IntPtr pvReserved2, out IntPtr phContext);

  [DllImport("winscard.dll")]
  public static extern int SCardReleaseContext(IntPtr hContext);

  [DllImport("winscard.dll", CharSet = CharSet.Auto)]
  public static extern int SCardListReaders(IntPtr hContext, string mszGroups, byte[] mszReaders, ref uint pcchReaders);

  [DllImport("winscard.dll", CharSet = CharSet.Auto)]
  public static extern int SCardConnect(IntPtr hContext, string szReader, uint dwShareMode, uint dwPreferredProtocols, out IntPtr phCard, out uint pdwActiveProtocol);

  [DllImport("winscard.dll")]
  public static extern int SCardDisconnect(IntPtr hCard, uint dwDisposition);

  [DllImport("winscard.dll")]
  public static extern int SCardTransmit(IntPtr hCard, ref SCARD_IO_REQUEST pioSendPci, byte[] pbSendBuffer, uint cbSendLength, IntPtr pioRecvPci, byte[] pbRecvBuffer, ref uint pcbRecvLength);
}
"@

if (-not ('PcscBridge' -as [type])) {
  Add-Type $code
}

function Convert-ToHex([byte[]]$Bytes) {
  (($Bytes | ForEach-Object { '{0:X2}' -f $_ }) -join '')
}

function Get-Readers($Context) {
  [uint32]$len = 0
  [void][PcscBridge]::SCardListReaders($Context, $null, $null, [ref]$len)
  if ($len -eq 0) { return @() }

  $buffer = New-Object byte[] ($len * 2)
  $rc = [PcscBridge]::SCardListReaders($Context, $null, $buffer, [ref]$len)
  if ($rc -ne 0) { return @() }

  $text = [Text.Encoding]::Unicode.GetString($buffer).Trim([char]0)
  @($text -split "`0" | Where-Object { $_ -and $_ -match 'PICC|ACS|ACR' })
}

function Read-AcsUid {
  $ctx = [IntPtr]::Zero
  $rc = [PcscBridge]::SCardEstablishContext(0, [IntPtr]::Zero, [IntPtr]::Zero, [ref]$ctx)
  if ($rc -ne 0) {
    return @{ ok = $false; status = 503; error = 'Smart Card context unavailable' }
  }

  try {
    $readers = Get-Readers $ctx
    if ($readers.Count -eq 0) {
      return @{ ok = $false; status = 404; error = 'No ACS PICC reader found' }
    }

    foreach ($reader in $readers) {
      $card = [IntPtr]::Zero
      [uint32]$protocol = 0
      $rc = [PcscBridge]::SCardConnect($ctx, $reader, 2, 3, [ref]$card, [ref]$protocol)
      if ($rc -ne 0) { continue }

      try {
        $send = [byte[]](0xFF, 0xCA, 0x00, 0x00, 0x00)
        $recv = New-Object byte[] 258
        [uint32]$recvLen = $recv.Length
        $io = New-Object PcscBridge+SCARD_IO_REQUEST
        $io.dwProtocol = $protocol
        $io.cbPciLength = 8

        $rc = [PcscBridge]::SCardTransmit($card, [ref]$io, $send, $send.Length, [IntPtr]::Zero, $recv, [ref]$recvLen)
        if ($rc -ne 0 -or $recvLen -lt 3) { continue }

        $bytes = $recv[0..($recvLen - 1)]
        if ($bytes[$recvLen - 2] -eq 0x90 -and $bytes[$recvLen - 1] -eq 0x00) {
          $uidBytes = $bytes[0..($recvLen - 3)]
          $uid = Convert-ToHex $uidBytes
          return @{ ok = $true; status = 200; reader = $reader; uid = $uid }
        }
      } finally {
        [void][PcscBridge]::SCardDisconnect($card, 0)
      }
    }

    return @{ ok = $false; status = 404; error = 'No card detected' }
  } finally {
    [void][PcscBridge]::SCardReleaseContext($ctx)
  }
}

function New-HttpJson([int]$StatusCode, $Body) {
  $json = ($Body | ConvertTo-Json -Compress)
  $bodyBytes = [Text.Encoding]::UTF8.GetBytes($json)
  $reason = switch ($StatusCode) {
    200 { 'OK' }
    204 { 'No Content' }
    404 { 'Not Found' }
    503 { 'Service Unavailable' }
    default { 'OK' }
  }
  $headers = @(
    "HTTP/1.1 $StatusCode $reason",
    'Content-Type: application/json; charset=utf-8',
    'Access-Control-Allow-Origin: *',
    'Access-Control-Allow-Methods: GET, OPTIONS',
    'Access-Control-Allow-Headers: Content-Type',
    'Cache-Control: no-store',
    "Content-Length: $($bodyBytes.Length)",
    'Connection: close',
    '',
    ''
  ) -join "`r`n"
  $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
  return @($headerBytes, $bodyBytes)
}

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse('127.0.0.1'), $Port)
$listener.Start()

Write-Host "ACS RFID bridge listening on http://127.0.0.1:$Port"
Write-Host 'Keep this window open while using automatic RFID scan/enroll.'

while ($true) {
  $client = $listener.AcceptTcpClient()
  $stream = $null
  try {
    $stream = $client.GetStream()
    $buffer = New-Object byte[] 4096
    $count = $stream.Read($buffer, 0, $buffer.Length)
    $requestText = [Text.Encoding]::ASCII.GetString($buffer, 0, $count)
    $requestLine = ($requestText -split "`r?`n")[0]
    $parts = $requestLine -split ' '
    $method = $parts[0]
    $path = ($parts[1] -split '\?')[0]

    if ($method -eq 'OPTIONS') {
      $chunks = New-HttpJson 204 @{}
    } elseif ($path -eq '/health') {
      $chunks = New-HttpJson 200 @{ ok = $true; service = 'acs-rfid-bridge' }
    } elseif ($path -eq '/uid') {
      Start-Sleep -Milliseconds $PollDelayMs
      $result = Read-AcsUid
      $chunks = New-HttpJson $result.status $result
    } else {
      $chunks = New-HttpJson 404 @{ ok = $false; error = 'Not found' }
    }

    foreach ($chunk in $chunks) {
      $stream.Write($chunk, 0, $chunk.Length)
    }
  } catch {
    if ($stream) {
      try {
        $chunks = New-HttpJson 503 @{ ok = $false; error = $_.Exception.Message }
        foreach ($chunk in $chunks) {
          $stream.Write($chunk, 0, $chunk.Length)
        }
      } catch {}
    }
  } finally {
    $client.Close()
  }
}
