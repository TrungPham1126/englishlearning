# Generates TEST-ONLY speech fixtures with Windows SAPI (System.Speech).
# Usage: powershell -ExecutionPolicy Bypass -File tests\fixtures\make_fixtures.ps1
Add-Type -AssemblyName System.Speech
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Save-Tts([string]$text, [string]$file) {
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.Rate = -1
    $fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
    $synth.SetOutputToWaveFile((Join-Path $dir $file), $fmt)
    $synth.Speak($text)
    $synth.SetOutputToNull()
    $synth.Dispose()
}

Save-Tts "Consistent pronunciation practice and phonemic awareness enhance oral fluency." "tts_full.wav"
Save-Tts "Consistent pronunciation" "tts_half.wav"
Write-Output "Fixtures written to $dir"

