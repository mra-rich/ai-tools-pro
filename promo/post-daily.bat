@echo off
REM ═══════════════════════════════════════════════════════════════
REM post-daily.bat — Jadwal harian promosi Threads (dipanggil Task Scheduler)
REM Urutan: generate konten hari ini → post ke Threads → log ke promo/post.log
REM ═══════════════════════════════════════════════════════════════
cd /d "%~dp0.."

echo [%date% %time%] ==== Siklus promosi harian ==== >> promo/post.log
node promo/generate.js >> promo/post.log 2>&1
node promo/post-api.js >> promo/post.log 2>&1
echo [%date% %time%] ==== selesai ==== >> promo/post.log