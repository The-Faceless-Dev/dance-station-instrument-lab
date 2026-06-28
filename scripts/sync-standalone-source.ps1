param(
  [string]$DanceStationRoot = "D:\autotransition"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$staticRoot = Join-Path $DanceStationRoot "src\autotransition\ui\static"
$targetRoot = Join-Path $repoRoot "standalone-source"

$required = @(
  "index.html",
  "app.js",
  "styles.css",
  "instruments"
)

foreach ($item in $required) {
  $source = Join-Path $staticRoot $item
  if (-not (Test-Path $source)) {
    throw "Missing standalone source: $source"
  }
}

New-Item -ItemType Directory -Force $targetRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $staticRoot "index.html") -Destination (Join-Path $targetRoot "index.html") -Force
Copy-Item -LiteralPath (Join-Path $staticRoot "app.js") -Destination (Join-Path $targetRoot "app.js") -Force
Copy-Item -LiteralPath (Join-Path $staticRoot "styles.css") -Destination (Join-Path $targetRoot "styles.css") -Force

$instrumentTarget = Join-Path $targetRoot "instruments"
if (Test-Path $instrumentTarget) {
  Remove-Item -LiteralPath $instrumentTarget -Recurse -Force
}
Copy-Item -LiteralPath (Join-Path $staticRoot "instruments") -Destination $instrumentTarget -Recurse -Force

Write-Host "Standalone Instrument Lab source snapshot refreshed from $DanceStationRoot"
