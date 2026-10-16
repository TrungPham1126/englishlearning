$auth = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" -Method Post -Body (@{ email = "admin@gmail.com"; password = "Admin123@" } | ConvertTo-Json) -ContentType "application/json"
$h = @{ Authorization = "Bearer $($auth.data.accessToken)" }

$students = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/users?role=ROLE_STUDENT" -Headers $h
Write-Host "--- STUDENTS ---"
foreach ($s in $students.data.content) {
    Write-Host "Student: $($s.email) | $($s.firstName) $($s.lastName) | ID: $($s.id) | Active: $($s.isActive)"
}

$classes = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/classrooms" -Headers $h
Write-Host "--- CLASSROOMS ---"
foreach ($c in $classes.data.content) {
    Write-Host "Class: $($c.name) | Level: $($c.level) | Status: $($c.status) | ID: $($c.id) | StudentsCount: $($c.currentStudentsCount)"
}

