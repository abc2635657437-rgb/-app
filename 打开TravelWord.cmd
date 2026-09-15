@echo off
setlocal
set "PROJECT_DIR=%~dp0"
set "DEVTOOLS="
for %%P in (
  "%ProgramFiles(x86)%\Tencent\微信web开发者工具\微信web开发者工具.exe"
  "%ProgramFiles%\Tencent\微信web开发者工具\微信web开发者工具.exe"
  "%LOCALAPPDATA%\微信web开发者工具\微信web开发者工具.exe"
) do if exist "%%~P" set "DEVTOOLS=%%~P"
if not defined DEVTOOLS (
  echo 未找到微信开发者工具。
  echo 请先安装微信开发者工具，然后重新双击此文件。
  pause
  exit /b 1
)
start "Travel World" "%DEVTOOLS%" -o "%PROJECT_DIR%"
endlocal
