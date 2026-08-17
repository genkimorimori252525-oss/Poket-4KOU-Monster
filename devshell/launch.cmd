@echo off
cd /d "%~dp0.."
bun "devshell\launch.js" %*
