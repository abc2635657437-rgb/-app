$ErrorActionPreference = 'Stop'
$envPath = Join-Path $PSScriptRoot '.env'

$anon = Read-Host 'Paste Supabase anon public key, then press Enter'
$service = Read-Host 'Paste Supabase service_role key, then press Enter'
if ([string]::IsNullOrWhiteSpace($anon) -or [string]::IsNullOrWhiteSpace($service)) { throw 'Keys cannot be empty' }
if ($anon -match 'PASTE_|replace-me' -or $service -match 'PASTE_|replace-me') { throw 'Placeholder key detected' }

$content = @(
  'NODE_ENV=development'
  'PORT=8787'
  'PUBLIC_APP_URL=http://localhost:8787'
  ''
  'SUPABASE_URL=https://dtzrqnwdktlkprlbwhaz.supabase.co'
  "SUPABASE_ANON_KEY=$anon"
  "SUPABASE_SERVICE_ROLE_KEY=$service"
  ''
  'GOOGLE_MAPS_SERVER_KEY='
  'AMAP_SERVER_KEY='
  'AI_API_KEY='
)
Set-Content -Path $envPath -Value $content -Encoding utf8
Write-Host "Environment file written. Secrets were not displayed."
