<#
.SYNOPSIS
    Sinh EF Core entities + DbContext tu database CoTuongOnline hien co.

.DESCRIPTION
    Script nay la BAN SAO LUU (fallback) cho lenh `dotnet ef dbcontext scaffold`.
    Connection string duoc doc tu appsettings.Development.json cua CoTuong.Web
    de khong phai hardcode trong source control va khong phai truyen lai
    tren command line.

    Sau khi script chay thanh cong, KHONG can chay `dotnet ef dbcontext scaffold`
    nua - entities da duoc sinh vao src/CoTuong.Infrastructure/Entities.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\database\scaffold-entities.ps1
#>
[CmdletBinding()]
param(
    [string] $Project = 'src/CoTuong.Infrastructure',
    [string] $StartupProject = 'src/CoTuong.Web',
    [string] $Context = 'CoTuongDbContext',
    [switch] $Force
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# --- Doc connection string tu config cua Web project -------------------------
$settingsPath = Join-Path $root "$StartupProject/appsettings.Development.json"
if (-not (Test-Path $settingsPath)) {
    throw "Khong tim thay $settingsPath"
}

$settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
$connectionString = $settings.ConnectionStrings.CoTuongOnline
if ([string]::IsNullOrWhiteSpace($connectionString)) {
    throw "ConnectionStrings:CoTuongOnline rong trong $settingsPath"
}

# --- Bien bien moi truong de lenh CLI khong phai lo connection string ------
$env:CoTuong__ConnectionStrings__CoTuongOnline = $connectionString

# --- Chay scaffold ----------------------------------------------------------
$argsList = @(
    'ef', 'dbcontext', 'scaffold',
    $connectionString,
    'Microsoft.EntityFrameworkCore.SqlServer',
    '--context', $Context,
    '--namespace', 'CoTuong.Infrastructure.Entities',
    '--use-database-names',
    '--no-onconfiguring',
    '--output-dir', 'Entities',
    '--project', $Project,
    '--startup-project', $StartupProject
)
if ($Force) { $argsList += '--force' }

Write-Host "Scaffold tu database CoTuongOnline -> $Project/Entities ..."
& dotnet @argsList
if ($LASTEXITCODE -ne 0) {
    throw "dotnet ef scaffold that bai (exit code $LASTEXITCODE)"
}

Write-Host "Hoan tat. Entities nam trong $Project/Entities."
