$auth = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" -Method Post -Body (@{ email = "student@gmail.com"; password = "Student123@" } | ConvertTo-Json) -ContentType "application/json"
$token = $auth.data.accessToken
$h = @{ Authorization = "Bearer $token" }

Write-Host "Student user ID: $($auth.data.user.id)"
Write-Host "Roles: $($auth.data.user.roles -join ', ')"

$courses = Invoke-RestMethod -Uri "http://localhost:8080/api/student/classrooms/my-courses" -Headers $h
Write-Host "Enrolled courses: $($courses.data.Count)"
foreach ($c in $courses.data) {
    Write-Host "Course: $($c.className) | ID: $($c.classId) | Status: $($c.status)"
}

