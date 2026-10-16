# English Learning Platform (Monorepo)

Dự án Nền tảng Học tiếng Anh Thông minh tích hợp Trí tuệ Nhân tạo (AI). Cấu trúc Monorepo hợp nhất toàn bộ mã nguồn: Backend, Frontend và Microservice AI chấm phát âm / sinh giọng đọc.

---

## 📂 Cấu Trúc Thư Mục Monorepo

```text
englishlearning/
├── src/                      # Backend Core: Java Spring Boot 3, RESTful APIs, Security, Business Logic
├── pom.xml                   # Maven dependencies & build configuration
├── frontend/                 # Frontend Web App: React 19, Vite, TypeScript, TailwindCSS
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── phonetics-service/        # AI Service: FastAPI, PyTorch (Wav2Vec2, Forced Alignment, Kokoro TTS)
│   ├── app/
│   ├── requirements.txt
│   └── Dockerfile
├── scripts/                  # Database migration & utility scripts
├── .gitignore                # Cấu hình bỏ qua file rác & artifacts cho cả 3 nền tảng
└── README.md
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Backend (Spring Boot 3)
* **Yêu cầu**: Java JDK 17+, Maven 3.8+, MySQL 8.0+
* **Cấu hình**: Chỉnh sửa thông tin kết nối MySQL và API Key trong `src/main/resources/application.properties`
* **Khởi chạy**:
  ```bash
  # Windows
  ./mvnw.cmd spring-boot:run
  
  # Linux / macOS
  ./mvnw spring-boot:run
  ```
* **Cổng mặc định**: `http://localhost:8080`

---

### 2. Frontend (React + Vite)
* **Yêu cầu**: Node.js 18+ (khuyên dùng Node 20+), npm hoặc yarn
* **Khởi chạy**:
  ```bash
  cd frontend
  npm install
  npm run dev
  ```
* **Cổng mặc định**: `http://localhost:5173`

---

### 3. AI Phonetics & TTS Service (Python)
* **Yêu cầu**: Python 3.10+, ffmpeg, espeak-ng
* **Khởi chạy**:
  ```bash
  cd phonetics-service
  python -m venv .venv
  
  # Kích hoạt môi trường ảo (Windows PowerShell)
  .venv\Scripts\Activate.ps1
  
  # Cài đặt thư viện
  pip install -r requirements.txt
  
  # Chạy service
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
  ```
* **Cổng mặc định**: `http://localhost:8000` (Tài liệu API Swagger: `http://localhost:8000/docs`)

---

## 🛡️ Công Nghệ Nổi Bật
- **AI Exercise Generator & Tutor**: Tích hợp Google Gemini & Groq LLM hỗ trợ tạo đề thi tự động chuẩn CEFR.
- **Phonetics Alignment & Scoring**: Đánh giá chi tiết từng âm vị (Phoneme level), phát hiện lỗi phát âm qua mô hình Wav2Vec2.
- **Natural Voice Synthesis**: Mô hình Kokoro-82M TTS sinh giọng đọc bản xứ US/UK tự nhiên.
- **Interactive Matching Board**: Nối từ vựng trực quan với tia nối SVG tự động căn chỉnh và phát âm đa điểm.
