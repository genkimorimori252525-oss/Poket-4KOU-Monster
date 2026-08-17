# devshell/install-shortcut.ps1
# デスクトップに開発シェルの起動ショートカット(.lnk)を作る。何度流しても同じ結果になる(上書き)。
# 絵のファイルは新設しない(CLAUDE.md 掟4)。アイコンは launch.cmd の既定のままにする。
# 使い方: powershell -NoProfile -ExecutionPolicy Bypass -File devshell/install-shortcut.ps1

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$configPath = Join-Path $scriptDir 'shell.config.json'

$config = Get-Content -Raw -Encoding UTF8 -Path $configPath | ConvertFrom-Json
$projectName = $config.projectName

$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutName = '{0} 開発シェル.lnk' -f $projectName
$shortcutPath = Join-Path $desktop $shortcutName
$targetPath = Join-Path $repoRoot 'devshell\launch.cmd'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetPath
$shortcut.WorkingDirectory = $repoRoot
$shortcut.Description = '{0} の開発シェルを開く' -f $projectName
$shortcut.Save()

Write-Output $shortcutPath
