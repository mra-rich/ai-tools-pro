@echo off
REM ═══════════════════════════════════════════════════════════════
REM install-scheduler.bat — Daftarkan Tugas Windows "PromoThreads"
REM Jalankan SEKALI sebagai Admin (klik-kanan → Run as administrator).
REM ═══════════════════════════════════════════════════════════════
set "DIR=%~dp0"
set "BAT=%DIR%post-daily.bat"

schtasks /Create /F /TN "AI Tools Pro\PromoThreads Harian" /TR "\"%BAT%\"" /SC DAILY /ST 09:00

echo.
echo Done. Jadwal 09:00 tiap hari. Cek: Task Scheduler -> AI Tools Pro\PromoThreads Harian
pause