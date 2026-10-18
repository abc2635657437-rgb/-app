[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^Q\d+$')][string]$PlaceId,
  [Parameter(Mandatory = $true)][string]$InputPath,
  [ValidateSet('full', 'categories')][string]$Mode = 'full',
  [string[]]$SkipKinds = @()
)

$ErrorActionPreference = 'Stop'
$InputPath = (Resolve-Path -LiteralPath $InputPath).Path
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tempRoot = Join-Path $env:TEMP "tw-guide-sheet-$PlaceId-$PID"
$allowedKinds = @('hero', 'eat', 'drink', 'play', 'joy', 'stay', 'go')
if ($SkipKinds | Where-Object { $_ -notin $allowedKinds }) { throw 'Unknown image kind in SkipKinds.' }
if (Test-Path -LiteralPath $tempRoot) { throw "Temporary folder already exists: $tempRoot" }
New-Item -ItemType Directory -Path $tempRoot | Out-Null
Add-Type -AssemblyName System.Drawing
$sheet = [System.Drawing.Image]::FromFile($InputPath)
$registered = 0

try {
  if ($sheet.Width -ne 1536 -or $sheet.Height -ne 1024) {
    throw "Expected a 1536x1024 contact sheet, received $($sheet.Width)x$($sheet.Height)."
  }

  if ($Mode -eq 'full') {
    $maps = @(
      '0,0,hero,1', '0,1,eat,1', '0,2,eat,2', '0,3,drink,1',
      '1,0,drink,2', '1,1,play,1', '1,2,play,2', '1,3,joy,1',
      '2,0,joy,2', '2,1,stay,1', '2,2,stay,2', '2,3,go,1', '3,0,go,2'
    )
    $tileWidth = 384
    $tileHeight = 256
  } else {
    $maps = @(
      '0,0,eat,1', '0,1,eat,2', '0,2,drink,1', '0,3,drink,2',
      '1,0,play,1', '1,1,play,2', '1,2,joy,1', '1,3,joy,2',
      '2,0,stay,1', '2,1,stay,2', '2,2,go,1', '2,3,go,2'
    )
    $tileWidth = 384
    $rowStarts = @(0, 341, 683)
    $rowHeights = @(341, 342, 341)
  }

  foreach ($entry in $maps) {
    $parts = $entry.Split(',')
    $row = [int]$parts[0]
    $column = [int]$parts[1]
    $kind = $parts[2]
    $slot = [int]$parts[3]
    if ($kind -in $SkipKinds) { continue }

    $sourceX = $column * $tileWidth + 8
    $sourceY = if ($Mode -eq 'full') { $row * $tileHeight + 8 } else { $rowStarts[$row] + 8 }
    $height = if ($Mode -eq 'full') { $tileHeight - 16 } else { $rowHeights[$row] - 16 }
    $width = $tileWidth - 16
    $bitmap = [System.Drawing.Bitmap]::new($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.DrawImage(
        $sheet,
        [System.Drawing.Rectangle]::new(0, 0, $width, $height),
        [System.Drawing.Rectangle]::new($sourceX, $sourceY, $width, $height),
        [System.Drawing.GraphicsUnit]::Pixel
      )
      $cropPath = Join-Path $tempRoot "$kind-$slot.png"
      $bitmap.Save($cropPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }

    & node (Join-Path $scriptRoot 'register-generated-guide-image.mjs') $PlaceId $cropPath $kind $slot
    if ($LASTEXITCODE -ne 0) { throw "Could not register $PlaceId $kind image $slot." }
    $registered++
  }
} finally {
  $sheet.Dispose()
  if (Test-Path -LiteralPath $tempRoot) {
    $resolvedTemp = (Resolve-Path -LiteralPath $tempRoot).Path
    if ($resolvedTemp -eq [System.IO.Path]::GetFullPath($tempRoot)) {
      Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
    }
  }
}

Write-Output "Registered $registered AI image(s) for $PlaceId."
