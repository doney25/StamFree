param(
  [string]$FilePath = "server/tmp_silence.wav",
  [string]$TargetPhoneme = "s",
  [double]$DurationAchieved = 1.0,
  [double]$TargetDuration = 2.0,
  [double]$CompletionPercentage = 50.0,
  [string]$Url = "http://localhost:5000/analyze/snake"
)

if (!(Test-Path $FilePath)) {
  Write-Error "Audio file not found: $FilePath"
  exit 1
}

$Form = @{
  audioFile = Get-Item $FilePath
  targetPhoneme = $TargetPhoneme
  durationAchieved = [string]$DurationAchieved
  targetDuration = [string]$TargetDuration
  completionPercentage = [string]$CompletionPercentage
}

try {
  $res = Invoke-WebRequest -Method Post -Uri $Url -Form $Form -TimeoutSec 15
  $json = $res.Content
  Write-Output $json
} catch {
  Write-Error $_
  exit 1
}
