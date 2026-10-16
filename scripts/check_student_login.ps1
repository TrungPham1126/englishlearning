$passwords = @("Student123@", "Student@123", "Password123@", "123456", "Admin123@")
foreach ($p in $passwords) {
    try {
        $body = @{ email = "student@gmail.com"; password = $p } | ConvertTo-Json
        $res = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" -Method Post -Body $body -ContentType "application/json"
        Write-Host "SUCCESS with password: $p"
        exit 0
    } catch {
        Write-Host "Failed with: $p"
    }
}
Write-Host "All failed. Let's check teststudent@example.com"
foreach ($p in $passwords) {
    try {
        $body = @{ email = "teststudent@example.com"; password = $p } | ConvertTo-Json
        $res = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" -Method Post -Body $body -ContentType "application/json"
        Write-Host "SUCCESS for teststudent with password: $p"
        exit 0
    } catch {
        Write-Host "Failed for teststudent with: $p"
    }
}

