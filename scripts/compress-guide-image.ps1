param([Parameter(Mandatory=$true)][string]$InputPath,[Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$picture = [System.Drawing.Image]::FromFile($InputPath)
try {
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
  $settings = [System.Drawing.Imaging.EncoderParameters]::new(1)
  $settings.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality,[long]88)
  try { $picture.Save($OutputPath,$codec,$settings) } finally { $settings.Dispose() }
} finally { $picture.Dispose() }
