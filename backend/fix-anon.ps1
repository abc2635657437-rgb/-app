$ErrorActionPreference = 'Stop'
$envPath = Join-Path $PSScriptRoot '.env'
$anon = Read-Host 'Paste the full Legacy anon public key, then press Enter'
if ([string]::IsNullOrWhiteSpace($anon) -or $anon -match 'PASTE_|replace-me') { throw 'Invalid anon key' }
$lines = Get-Content $envPath
$found = $false
$lines = $lines | ForEach-Object {
  if ($_ -match '^\s*SUPABASE_ANON_KEY=') { $found = $true; "SUPABASE_ANON_KEY=$anon" } else { $_ }
}
if (-not $found) { $lines += "SUPABASE_ANON_KEY=$anon" }
Set-Content -Path $envPath -Value $lines -Encoding utf8
Write-Host 'Anon key updated.'
