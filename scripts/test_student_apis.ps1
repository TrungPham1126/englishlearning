$ErrorActionPreference = "Continue"

$auth = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" -Method Post -Body (@{ email = "student@gmail.com"; password = "Student123@" } | ConvertTo-Json) -ContentType "application/json"
$token = $auth.data.accessToken
$h = @{ Authorization = "Bearer $token" }

$classId = "a050c3cb-48e1-4726-b7d3-28cb76bd0a80"

function Test-Endpoint($title, $url, $method="Get", $body=$null, $contentType="application/json") {
    Write-Host "`n=== TESTING: $title ===" -ForegroundColor Cyan
    Write-Host "URL: $url"
    try {
        if ($body) {
            $res = Invoke-RestMethod -Uri $url -Headers $h -Method $method -Body $body -ContentType $contentType
        } else {
            $res = Invoke-RestMethod -Uri $url -Headers $h -Method $method
        }
        Write-Host "STATUS: SUCCESS" -ForegroundColor Green
        if ($res.data) {
            Write-Host "DATA: $(ConvertTo-Json $res.data -Depth 2 -Compress)"
        } else {
            Write-Host "DATA: (null/empty)"
        }
        return $res
    } catch {
        Write-Host "STATUS: FAILED" -ForegroundColor Red
        Write-Host "ERROR: $($_.Exception.Message)"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Host "BODY: $($reader.ReadToEnd())" -ForegroundColor Yellow
        }
        return $null
    }
}

# 1. My Courses
Test-Endpoint "1. My Courses" "http://localhost:8080/api/student/classrooms/my-courses"

# 2. Class Lessons
Test-Endpoint "2. Class Lessons" "http://localhost:8080/api/curriculum/classes/$classId/lessons"

# 3. Daily Plans Overview
Test-Endpoint "3. Daily Homework Overview" "http://localhost:8080/api/v1/curriculum/daily-plans/classrooms/$classId/student-overview"

# 4. Class Assignments
Test-Endpoint "4. Class Assignments" "http://localhost:8080/api/v1/student/classrooms/$classId/assignments"

# 5. Due Flashcards / Vocabularies
Test-Endpoint "5. Due Vocabularies" "http://localhost:8080/api/v1/student/vocabularies/due?limit=20"

# 6. Skill Profile / Analytics
Test-Endpoint "6. Skill Profile Analytics" "http://localhost:8080/api/v1/analytics/my-profile"

# 7. Notifications
Test-Endpoint "7. Notifications" "http://localhost:8080/api/v1/notifications?page=0&size=10"

# 8. User Profile Me
Test-Endpoint "8. Profile / Me" "http://localhost:8080/api/v1/auth/me"

