# Builds the store-ready zips:
#   TabSnooze-chrome-vX.Y.Z.zip   (manifest.json — Chrome Web Store)
#   TabSnooze-firefox-vX.Y.Z.zip  (manifest.firefox.json — Firefox AMO)
# Usage:  powershell -ExecutionPolicy Bypass -File build.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = $PSScriptRoot

$files = @(
  'background\background.js',
  'icons\icon16.png',
  'icons\icon48.png',
  'icons\icon128.png',
  'options\options.css',
  'options\options.html',
  'options\options.js',
  'popup\mascot.js',
  'popup\popup.css',
  'popup\popup.html',
  'popup\popup.js',
  'shared\i18n.js',
  'shared\settings.js'
)

$chrome  = Get-Content (Join-Path $root 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$firefox = Get-Content (Join-Path $root 'manifest.firefox.json') -Raw -Encoding UTF8 | ConvertFrom-Json

if ($chrome.version -ne $firefox.version) {
  throw "Version mismatch: manifest.json is $($chrome.version) but manifest.firefox.json is $($firefox.version). Update both before building."
}
$version = $chrome.version

function New-ExtensionZip {
  param([string]$ZipPath, [string]$ManifestPath)

  if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
  $zip = [System.IO.Compression.ZipFile]::Open($ZipPath, 'Create')
  try {
    foreach ($f in $files) {
      $null = [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip, (Join-Path $root $f), ($f -replace '\\', '/'))
    }
    $null = [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $ManifestPath, 'manifest.json')
  }
  finally { $zip.Dispose() }
  Write-Host "OK  $ZipPath"
}

New-ExtensionZip -ZipPath (Join-Path $root "TabSnooze-chrome-v$version.zip")  -ManifestPath (Join-Path $root 'manifest.json')
New-ExtensionZip -ZipPath (Join-Path $root "TabSnooze-firefox-v$version.zip") -ManifestPath (Join-Path $root 'manifest.firefox.json')
