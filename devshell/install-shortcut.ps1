# devshell/install-shortcut.ps1
# デスクトップに開発シェルの起動ショートカット(.lnk)を作る。何度流しても同じ結果になる(上書き)。
# 絵のファイルは新設しない(CLAUDE.md 掟4)。アイコンはブラウザのものを借りる。
# 使い方: powershell -NoProfile -ExecutionPolicy Bypass -File devshell/install-shortcut.ps1

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$configPath = Join-Path $scriptDir 'shell.config.json'

$config = Get-Content -Raw -Encoding UTF8 -Path $configPath | ConvertFrom-Json
$projectName = $config.projectName

$desktop = [Environment]::GetFolderPath('Desktop')
# 名前は設定の shortcutName を優先する。無ければ「<名前> 開発シェル」。
# ハブのように名前自体が完結しとるものは、後ろに足すと重なるけん。
$shortcutName = if ($config.shortcutName) { $config.shortcutName + '.lnk' } else { '{0} 開発シェル.lnk' -f $projectName }
$shortcutPath = Join-Path $desktop $shortcutName
# launch.cmd を直に指すと cmd.exe の黒い窓が居座る。wscript 経由で窓なしに回す。
# 中を覗きたいときは devshell\launch.cmd を直に叩けばよか(そっちは残しとる)。
$vbs = Join-Path $repoRoot 'devshell\launch.vbs'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = 'wscript.exe'
$shortcut.Arguments = '"{0}"' -f $vbs
$shortcut.WorkingDirectory = $repoRoot
$shortcut.Description = '{0} の開発シェルを開く' -f $projectName
# wscript.exe の紙アイコンやと何のショートカットか分からんけん、ブラウザの絵を借りる。
# 絵のファイルは新設しとらん(掟4)。
$ico = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($ico) { $shortcut.IconLocation = '{0},0' -f $ico }
$shortcut.Save()

Write-Output $shortcutPath
