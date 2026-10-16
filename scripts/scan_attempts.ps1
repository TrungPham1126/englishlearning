$auth = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" -Method Post -Body (@{ email = "student@gmail.com"; password = "Student123@" } | ConvertTo-Json) -ContentType "application/json"
$h = @{ Authorization = "Bearer $($auth.data.accessToken)" }

$assigns = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/student/classrooms/a050c3cb-48e1-4726-b7d3-28cb76bd0a80/assignments" -Headers $h
Write-Host "Count: $($assigns.data.Count)"
foreach ($a in $assigns.data) {
    try {
        $attempts = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/student/assignments/$($a.id)/attempts" -Headers $h
        Write-Host "Assign: $($a.title) | ID: $($a.id) | PrevAttempts: $($attempts.data.Count)"
        if ($attempts.data.Count -gt 0) {
            $latest = $attempts.data[0]
            $det = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/student/assignments/attempts/$($latest.attemptId)" -Headers $h
            Write-Host "  -> AttemptId: $($latest.attemptId) | Status: $($latest.status) | Score: $($latest.score) | QuestionsCount: $($det.data.questions.Count)"
        }
    } catch {
        Write-Host "Error for $($a.id): $($_.Exception.Message)"
    }
}

