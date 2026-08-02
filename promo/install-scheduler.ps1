$taskPath = 'AI Tools Pro\'
# Hapus tugas tes
Unregister-ScheduledTask -TaskName 'PromoThreadsTes' -TaskPath $taskPath -Confirm:$false -ErrorAction SilentlyContinue
# Daftarkan jadwal harian 09:00 dengan quoting aman (cmd /c "path dgn spasi")
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c "C:\root project\free ai model\promo\post-daily.bat"'
$trigger = New-ScheduledTaskTrigger -Daily -At (Get-Date -Hour 9 -Minute 0 -Second 0)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName 'PromoThreads Harian' -TaskPath $taskPath -Action $action -Trigger $trigger -Settings $settings -Force -Description 'Posting konten Threads harian 09:00 (generate + post API)' | Out-Null
Write-Host 'OK — jadwal harian 09:00 terdaftar.'
gci 'C:\root project\free ai model\promo\threads\*.md*' | Select-Object Name