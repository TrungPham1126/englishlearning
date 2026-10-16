$ErrorActionPreference = "Stop"

$auth = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" -Method Post -Body (@{ email = "student@gmail.com"; password = "Student123@" } | ConvertTo-Json) -ContentType "application/json"
$token = $auth.data.accessToken
$h = @{ Authorization = "Bearer $token" }

$classId = "a050c3cb-48e1-4726-b7d3-28cb76bd0a80"
$assigns = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/student/classrooms/$classId/assignments" -Headers $h

Write-Host "Found $($assigns.data.Count) assignments."
foreach ($a in $assigns.data) {
    Write-Host "Assignment: $($a.title) | ID: $($a.id) | Questions: $($a.totalQuestions)"
}

$firstAssign = $assigns.data[0]
Write-Host "`n--- STARTING ATTEMPT FOR: $($firstAssign.title) ($($firstAssign.id)) ---"
$attempt = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/student/assignments/$($firstAssign.id)/start" -Headers $h -Method Post

Write-Host "Attempt ID: $($attempt.data.attemptId) | Status: $($attempt.data.status)"
Write-Host "Questions in attempt: $($attempt.data.questions.Count)"

$answers = @()
foreach ($q in $attempt.data.questions) {
    Write-Host "Q: $($q.promptText) (Type: $($q.questionType))"
    if ($q.options -and $q.options.Count -gt 0) {
        Write-Host "  Choosing option: $($q.options[0].id) - $($q.options[0].optionText)"
        $answers += @{
            questionId = $q.questionId
            selectedOptionId = $q.options[0].id
        }
    } elseif ($q.questionType -eq "WRITING") {
        Write-Host "  Writing essay answer..."
        $answers += @{
            questionId = $q.questionId
            textAnswer = "This is a well-structured essay about learning English with artificial intelligence."
        }
    } else {
        Write-Host "  Fill-in/Short text answer..."
        $answers += @{
            questionId = $q.questionId
            textAnswer = "learning"
        }
    }
}

Write-Host "`n--- SUBMITTING ATTEMPT ---"
$subBody = @{
    assignmentId = $firstAssign.id
    answers = $answers
} | ConvertTo-Json -Depth 5

$submitted = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/student/assignments/$($firstAssign.id)/attempts/$($attempt.data.attemptId)/submit" -Headers $h -Method Post -Body $subBody -ContentType "application/json"

Write-Host "Submission result: Status: $($submitted.data.status) | Score: $($submitted.data.score) / $($submitted.data.totalScore)"

Write-Host "`n--- GETTING ATTEMPT DETAIL ---"
$detail = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/student/assignments/attempts/$($attempt.data.attemptId)" -Headers $h
Write-Host "Detail fetched successfully. Total answers: $($detail.data.answers.Count) | Status: $($detail.data.status)"
