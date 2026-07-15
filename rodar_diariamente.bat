@echo off
cd /d "%~dp0"
call npm run start > logs.txt 2>&1
exit
