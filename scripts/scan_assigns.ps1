$auth = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" -Method Post -Body (@{ email = "student@gmail.com"; password = "Student123@" } | ConvertTo-Json) -ContentType "application/json"
$token = $auth.data.accessToken
$h = @{ Authorization = "Bearer $token" }

$classId = "a050c3cb-48e1-4726-b7d3-28cb76bd0a80"
$assigns = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/student/classrooms/$classId/assignments" -Headers $h

foreach ($a in $assigns.data) {
    try {
        $attempt = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/student/assignments/$($a.id)/start" -Headers $h -Method Post
        $qCount = $attempt.data.questions.Count
        if ($qCount -gt 0) {
            Write-Host "FOUND ASSIGNMENT WITH QUESTIONS: $($a.title) | ID: $($a.id) | Questions: $qCount | Type: $($attempt.data.questions[0].questionType)"
        }
    } catch {
        # ignore
    }
}

