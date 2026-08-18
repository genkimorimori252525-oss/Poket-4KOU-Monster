' 黒い窓を出さんための一枚。
'
' ショートカットが launch.cmd を直に叩くと、cmd.exe の黒い窓が
' シェルを閉じるまで居座る。ここを噛ませて窓なし(0)で回す。
'
' 引き換えに、bun が落ちても何も表示されん。**それでも困らん** ——
' しくじったら Chromium の窓がそもそも出てこんけん、それが合図になる。
' 中で何が起きとるか見たいときは devshell\launch.cmd を直に叩けばよか。

Option Explicit
Dim fso, sh, here, root
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
root = fso.GetParentFolderName(here)
sh.CurrentDirectory = root
sh.Run "cmd /c bun """ & here & "\launch.js""", 0, False
