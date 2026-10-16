$ErrorActionPreference = "Continue"

$auth = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" -Method Post -Body (@{ email = "student@gmail.com"; password = "Student123@" } | ConvertTo-Json) -ContentType "application/json"
$token = $auth.data.accessToken
$h = @{ Authorization = "Bearer $token" }

Write-Host "================ TESTING AI WRITING EVALUATION ================" -ForegroundColor Cyan
$writingTopic = "Some people think that universities should provide graduates with the knowledge and skills needed in the workplace. Others think that the true function of a university should be to give access to knowledge for its own sake, regardless of whether the course of study is useful to an employer. Discuss both views and give your opinion."
$essay = "In today's fast-paced economic environment, whether universities should focus on practical vocational training or theoretical knowledge remains a subject of intense debate. While preparing graduates for employment is essential for economic growth, fostering intellectual curiosity and fundamental research forms the cornerstone of academic enlightenment. In my opinion, modern tertiary institutions must strike a balanced synergy between both approaches to cultivate versatile scholars."

try {
    $writingRes = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/ai/writing/evaluate?topic=$([System.Uri]::EscapeDataString($writingTopic))" -Headers $h -Method Post -Body $essay -ContentType "text/plain"
    Write-Host "[PASS] AI Writing Evaluation Success!" -ForegroundColor Green
    Write-Host "Band: $($writingRes.data.overallBand) | CEFR: $($writingRes.data.estimatedCefr)"
    Write-Host "Feedback: $($writingRes.data.generalFeedback)"
} catch {
    Write-Host "[FAIL] AI Writing Evaluation Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $r = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Details: $($r.ReadToEnd())" -ForegroundColor Yellow
    }
}

Write-Host "`n================ TESTING AI READING SHORT ANSWER EVALUATION ================" -ForegroundColor Cyan
$readingBody = @{
    passage = "The Solar System formed 4.6 billion years ago from the gravitational collapse of a giant interstellar molecular cloud. The vast majority of the system's mass is in the Sun, with the majority of the remaining mass contained in Jupiter."
    question = "Which planet contains the majority of the non-solar mass in the Solar System?"
    studentAnswer = "Jupiter contains most of the remaining mass."
    expectedAnswer = "Jupiter"
} | ConvertTo-Json

try {
    $readingRes = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/ai/reading/evaluate-short-answer" -Headers $h -Method Post -Body $readingBody -ContentType "application/json"
    Write-Host "[PASS] AI Reading Short Answer Evaluation Success!" -ForegroundColor Green
    Write-Host "Result: $(ConvertTo-Json $readingRes.data -Compress)"
} catch {
    Write-Host "[FAIL] AI Reading Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $r = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Details: $($r.ReadToEnd())" -ForegroundColor Yellow
    }
}

Write-Host "`n================ TESTING AI SHADOWING EVALUATION ================" -ForegroundColor Cyan
$audioPath = "d:\codes\doanchuyennganh\englishlearning\dummy_audio.wav"
if (Test-Path $audioPath) {
    try {
        $boundary = [System.Guid]::NewGuid().ToString()
        $LF = "`r`n"
        $fileBytes = [System.IO.File]::ReadAllBytes($audioPath)
        
        $bodyLines = @(
            "--$boundary",
            'Content-Disposition: form-data; name="referenceSentence"',
            '',
            'Hello and welcome to the English Learning Platform.',
            "--$boundary",
            'Content-Disposition: form-data; name="audio"; filename="dummy_audio.wav"',
            'Content-Type: audio/wav',
            ''
        )
        $headerBytes = [System.Text.Encoding]::UTF8.GetBytes(($bodyLines -join $LF) + $LF)
        $footerBytes = [System.Text.Encoding]::UTF8.GetBytes("$LF--$boundary--$LF")
        
        $totalBytes = New-Object byte[] ($headerBytes.Length + $fileBytes.Length + $footerBytes.Length)
        [System.Buffer]::BlockCopy($headerBytes, 0, $totalBytes, 0, $headerBytes.Length)
        [System.Buffer]::BlockCopy($fileBytes, 0, $totalBytes, $headerBytes.Length, $fileBytes.Length)
        [System.Buffer]::BlockCopy($footerBytes, 0, $totalBytes, $headerBytes.Length + $fileBytes.Length, $footerBytes.Length)
        
        $req = [System.Net.HttpWebRequest]::Create("http://localhost:8080/api/v1/ai/speaking/shadowing-evaluate")
        $req.Method = "POST"
        $req.ContentType = "multipart/form-data; boundary=$boundary"
        $req.Headers.Add("Authorization", "Bearer $token")
        $req.ContentLength = $totalBytes.Length
        
        $stream = $req.GetRequestStream()
        $stream.Write($totalBytes, 0, $totalBytes.Length)
        $stream.Close()
        
        $resp = $req.GetResponse()
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $respJson = $reader.ReadToEnd() | ConvertFrom-Json
        Write-Host "[PASS] AI Shadowing Evaluation Success!" -ForegroundColor Green
        Write-Host "Overall Score: $($respJson.data.overallScore) | Accuracy: $($respJson.data.accuracyScore) | EvaluatedBy: $($respJson.data.evaluatedBy)"
        Write-Host "Transcript: $($respJson.data.transcribedText)"
    } catch {
        Write-Host "[FAIL] AI Shadowing Failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $r = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Host "Details: $($r.ReadToEnd())" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "dummy_audio.wav not found at $audioPath" -ForegroundColor Yellow
}

