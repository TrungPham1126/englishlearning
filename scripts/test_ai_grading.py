import requests
import json
import uuid
import os

# ==========================================
# CẤU HÌNH API
# ==========================================
BASE_URL = "http://localhost:8080/api/v1"
AI_URL = f"{BASE_URL}/ai"
AUTH_URL = f"{BASE_URL}/auth/login" # Giả định endpoint đăng nhập của bạn là /auth/login

# Thông tin tài khoản Student để lấy Token
STUDENT_USERNAME = "student@example.com"
STUDENT_PASSWORD = "password123"

# ==========================================
# 1. HÀM LẤY TOKEN TỰ ĐỘNG
# ==========================================
def get_jwt_token():
    print(f"Đang lấy token cho {STUDENT_USERNAME}...")
    try:
        response = requests.post(AUTH_URL, json={
            "username": STUDENT_USERNAME,
            "password": STUDENT_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("data", {}).get("token", "")
            print("✅ Đã lấy được JWT Token!")
            return f"Bearer {token}"
        else:
            print("❌ Đăng nhập thất bại. Vui lòng cập nhật lại username/password hoặc gán token thủ công.")
            return "Bearer YOUR_JWT_TOKEN_HERE"
    except Exception as e:
        print("❌ Lỗi gọi API đăng nhập:", e)
        return "Bearer YOUR_JWT_TOKEN_HERE"

# ==========================================
# 2. HÀM TEST WRITING
# ==========================================
def test_writing_evaluation(headers, answer_id):
    print("\n--- 📝 TEST API CHẤM ĐIỂM WRITING ---")
    url = f"{AI_URL}/writing/evaluate"
    
    topic = "Discuss the advantages and disadvantages of online learning."
    essay_text = "Online learning has many benefits but also some drawbacks. One good thing is that students can study from anywhere. However, it can make students feel isolated."
    
    params = {
        "topic": topic,
        "studentAnswerId": answer_id
    }
    
    response = requests.post(url, headers=headers, params=params, data=essay_text)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print("✅ Kết quả JSON:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    else:
        print("❌ Lỗi:", response.text)

# ==========================================
# 3. HÀM TEST SHADOWING
# ==========================================
def test_shadowing_evaluation(headers, answer_id):
    print("\n--- 🗣️ TEST API CHẤM ĐIỂM SHADOWING ---")
    url = f"{AI_URL}/speaking/shadowing-evaluate"
    
    # Tạo một file txt nhỏ rồi đổi đuôi để fake file wav nếu chưa có
    if not os.path.exists("dummy_audio.wav"):
        with open("dummy_audio.wav", "wb") as f:
            # Tạo 1 đoạn byte của 1 file wav trống rất nhỏ để pass bước upload file
            f.write(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00")
            print("⚠️ Đã tạo file âm thanh giả (dummy_audio.wav) để test.")

    try:
        with open("dummy_audio.wav", "rb") as f:
            files = {"audio": ("dummy_audio.wav", f, "audio/wav")}
            data = {
                "studentAnswerId": answer_id,
                "referenceSentence": "Small changes can make our eating habits healthier."
            }
            response = requests.post(url, headers=headers, files=files, data=data)
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                print("✅ Kết quả JSON:")
                print(json.dumps(response.json(), indent=2, ensure_ascii=False))
            else:
                print("❌ Lỗi:", response.text)
    except Exception as e:
        print("❌ Lỗi khi đọc file hoặc gọi API:", e)

if __name__ == "__main__":
    jwt_token = get_jwt_token()
    headers = {"Authorization": jwt_token}
    
    # Tạo UUID giả lập cho studentAnswerId
    fake_student_answer_id = str(uuid.uuid4())
    
    test_writing_evaluation(headers, fake_student_answer_id)
    test_shadowing_evaluation(headers, fake_student_answer_id)
