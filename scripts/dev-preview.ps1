$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$devRoot = Join-Path $repoRoot ".dev-runtime"
$appDataDir = Join-Path $devRoot "app-data"
$codexDir = Join-Path $devRoot "codex"
$devTauriConfig = Join-Path $repoRoot "src-tauri\tauri.dev.conf.json"

New-Item -ItemType Directory -Force -Path $appDataDir | Out-Null
New-Item -ItemType Directory -Force -Path $codexDir | Out-Null

function Copy-IfMissing {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (!(Test-Path -LiteralPath $Source) -or (Test-Path -LiteralPath $Destination)) {
        return
    }

    $parent = Split-Path -Parent $Destination
    if ($parent) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }

    Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
}

$prodAppDataDir = Join-Path $env:APPDATA "com.carry.codex-tools"
$prodStorePath = Join-Path $prodAppDataDir "accounts.json"
$devStorePath = Join-Path $appDataDir "accounts.json"
if (Test-Path -LiteralPath $prodStorePath) {
    Copy-Item -LiteralPath $prodStorePath -Destination $devStorePath -Force
}
Copy-IfMissing -Source (Join-Path $prodAppDataDir "profiles") -Destination (Join-Path $appDataDir "profiles")

if (Test-Path -LiteralPath $devStorePath) {
    try {
        $store = Get-Content -LiteralPath $devStorePath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($null -eq $store.settings) {
            $store | Add-Member -NotePropertyName "settings" -NotePropertyValue ([pscustomobject]@{})
        }
        if ($store.settings.PSObject.Properties.Name -contains "autoStartApiProxy") {
            $store.settings.autoStartApiProxy = $false
        } else {
            $store.settings | Add-Member -NotePropertyName "autoStartApiProxy" -NotePropertyValue $false
        }
        if ($store.settings.PSObject.Properties.Name -contains "apiProxyPort") {
            $store.settings.apiProxyPort = 8788
        } else {
            $store.settings | Add-Member -NotePropertyName "apiProxyPort" -NotePropertyValue 8788
        }
        $json = $store | ConvertTo-Json -Depth 100
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($devStorePath, $json, $utf8NoBom)
    } catch {
        Write-Warning "Could not adjust dev preview account settings; continuing with isolated store copy."
    }
}

$prodCodexDir = Join-Path $env:USERPROFILE ".codex"
Copy-IfMissing -Source (Join-Path $prodCodexDir "auth.json") -Destination (Join-Path $codexDir "auth.json")
Copy-IfMissing -Source (Join-Path $prodCodexDir "config.toml") -Destination (Join-Path $codexDir "config.toml")

$env:CODEX_TOOLS_DEV_DATA_DIR = $appDataDir
$env:CODEX_TOOLS_DEV_CODEX_DIR = $codexDir

$cargoBin = Join-Path $env:USERPROFILE ".cargo\\bin"
if (Test-Path -LiteralPath $cargoBin) {
    $env:PATH = "$cargoBin;$env:PATH"
}

$rustToolchainBin = Join-Path $env:USERPROFILE ".rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin"
if (Test-Path -LiteralPath $rustToolchainBin) {
    $env:PATH = "$rustToolchainBin;$env:PATH"
    $rustcBin = Join-Path $rustToolchainBin "rustc.exe"
    if (Test-Path -LiteralPath $rustcBin) {
        $env:RUSTC = $rustcBin
    }
}

Write-Host "Dev preview will use isolated directories:"
Write-Host ("  app data: {0}" -f $appDataDir)
Write-Host ("  codex dir: {0}" -f $codexDir)
Write-Host "Dev preview will use isolated app identity and ports:"
Write-Host "  identifier: com.carry.codex-tools.dev"
Write-Host "  dev url: http://localhost:5174"
Write-Host "  api proxy port: 8788"

Set-Location $repoRoot
$tauriCli = Join-Path $repoRoot "node_modules\.bin\tauri.cmd"
& $tauriCli dev -c $devTauriConfig
