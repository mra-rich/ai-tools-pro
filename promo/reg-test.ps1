$taskPath = 'AI Tools Pro\'
$taskName = 'PromoThreadsTes'
Unregister-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Confirm:$false -ErrorAction SilentlyContinue
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c "C:\root project\free ai model\promo\post-daily.bat"'
$at = (Get-Date).AddMinutes(3)
$trigger = New-ScheduledTaskTrigger -Once -At $at
Register-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Action $action -Trigger $trigger -Force | Out-Null
Write-Host "Terdaftar untuk $($at.ToString('HH:mm:ss')) (jam sekarang: $(Get-Date -Format 'HH:mm'))"