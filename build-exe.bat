@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  CodeBuddy Launcher - Build EXE (C#)
echo  ===============================
echo.

:: Find C# compiler
set "CSC="
if exist "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" set "CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if "%CSC%"=="" (
    echo [错误] 未找到 C# 编译器 csc.exe
    echo 请安装 .NET Framework 4.x SDK
    pause
    exit /b 1
)

echo 编译器: %CSC%
echo.

echo 正在编译...

:: Check for icon
set "ICON_FLAG="
if exist "%~dp0app.ico" set "ICON_FLAG=/win32icon:app.ico"

"%CSC%" /target:winexe /out:codebuddy-launcher.exe /reference:System.Windows.Forms.dll /reference:System.Drawing.dll %ICON_FLAG% launcher.cs

if %errorlevel% neq 0 (
    echo.
    echo [错误] 编译失败
    pause
    exit /b 1
)

if not exist "codebuddy-launcher.exe" (
    echo [错误] EXE 未生成
    pause
    exit /b 1
)

echo.
echo ===============================
echo  编译完成!
echo  输出: %~dp0codebuddy-launcher.exe
echo ===============================
echo.
echo 您可以双击 codebuddy-launcher.exe 快速启动

:: Create shortcut
powershell -Command ^
  "$WshShell = New-Object -ComObject WScript.Shell; " ^
  "$Shortcut = $WshShell.CreateShortcut('%~dp0CodeBuddy启动器.lnk'); " ^
  "$Shortcut.TargetPath = '%~dp0codebuddy-launcher.exe'; " ^
  "$Shortcut.WorkingDirectory = '%~dp0'; " ^
  "$Shortcut.Description = 'CodeBuddy 快速启动器'; " ^
  "$Shortcut.Save()"

echo 已创建快捷方式: CodeBuddy启动器.lnk
echo.
pause