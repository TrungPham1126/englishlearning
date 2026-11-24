# English Learning Platform (Monorepo)

Nền tảng học tiếng Anh thông minh tích hợp AI, phục vụ **học sinh – giáo viên – quản trị viên** với lộ trình học theo ngày, bài tập CBT đa kỹ năng, chấm Speaking/Writing bằng AI và quản lý lớp học.

Monorepo gồm 4 thành phần chạy độc lập:

| Thành phần | Công nghệ | Cổng mặc định |
| :--- | :--- | :--- |
| **Backend** | Java 17, Spring Boot 3, Spring Security (JWT), JPA/Hibernate, MySQL 8 | `8080` |
| **Frontend** | React 19, Vite 8, TypeScript, TailwindCSS 3, Zustand, Vitest | `5173` (dev) / `3000` (Docker) |
| **phonetics-service** | FastAPI, PyTorch (Wav2Vec2 forced alignment, Praat formant F1/F2), Kokoro-82M TTS | `8000` |
| **writing-scorer** | Python (PyTorch/Transformers) – mô hình chấm IELTS Writing cục bộ | `8001` |

---

## ✨ Tính năng chính

**Học sinh**
- Lộ trình học theo **ngày** (Daily Plan), mở khóa bài theo tiến độ.
- Làm bài tập CBT: trắc nghiệm, đúng/sai, điền từ, sắp xếp từ, nối cặp, Reading, Listening (nghe chậm/nhanh), nút **Gợi ý** riêng khi làm bài, xem lại đáp án (A B C D) và điểm từng câu.
- **Speaking**: Luyện nhại âm (Shadowing) chấm theo âm vị IPA, Q&A / IELTS Part 1-2-3 chấm theo band; sóng âm chỉ hiện khi nghe mẫu / ghi âm.
- **Writing**: chấm IELTS Task 1, Task 2 và Paragraph.
- Hồ sơ năng lực 6 kỹ năng, streak học tập, thông báo.

**Giáo viên**
- Quản lý lớp, học sinh, bài giảng, video (chuyển đổi HLS).
- Tạo bài tập thủ công, import Excel hoặc **sinh bằng AI**, có sinh audio TTS.
- Tạo đề thi (Exam), chấm bài thủ công/AI, xem hồ sơ học tập học sinh.

**Quản trị viên**
- Quản lý người dùng, giáo viên, học sinh, lớp học, thư viện tài nguyên, kiểm duyệt video.
- Báo cáo, theo dõi AI (quota, token), nhật ký hệ thống (Audit Log), thông báo hệ thống.

---

## 🧠 Kiến trúc chấm điểm AI

**Shadowing / Phát âm** – fallback 3 tầng:
1. **Python acoustic** (`phonetics-service`): Wav2Vec2 + Praat F1/F2, GOP, hiệu chuẩn trên SpeechOcean762.
2. **Cloud AI**: Gemini (multimodal) → Groq (Whisper + LLaMA).
3. **Rule-based offline** khi mọi dịch vụ đều lỗi.

**Speaking (Q&A / IELTS)**: Whisper (Groq) hoặc Gemini STT → Python chấm phát âm → LLM chấm theo rubric IELTS, có guardrail (im lặng, nói tiếng Việt, đọc vẹt đề, giới hạn band theo độ dài). Điểm Speaking được hiệu chỉnh **+10%** để bớt cứng nhắc.

**Writing**: ưu tiên mô hình cục bộ `writing-scorer`, fallback sang LLM.

---

## 📂 Cấu trúc thư mục

```text
englishlearning/
├── src/main/java/com/englishlearning/   # Backend theo module:
│   ├── ai/ analytics/ assignment/ auth/ classroom/
│   └── common/ curriculum/ notification/ submission/ system/ video/
├── src/main/resources/                  # application.properties, migration SQL
├── src/test/                            # JUnit 5 + Mockito + E2E
├── frontend/                            # React app, chia theo feature
│   └── src/features/{admin,auth,student,teacher}/
├── phonetics-service/                   # FastAPI chấm phát âm + TTS
├── writing-scorer/                      # Dịch vụ chấm Writing cục bộ
├── scripts/                             # Script DB / tiện ích
├── docs/                                # Tài liệu thiết kế
├── plantuml_diagrams/                   # Sơ đồ UML (PlantUML)
├── uploads/                             # File upload & audio (không commit nội dung lớn)
├── docker-compose.yml  Dockerfile  .env.example
└── pom.xml  mvnw  mvnw.cmd
```

---

## ⚙️ Yêu cầu môi trường

- JDK **17**, Node.js **20+**, Python **3.10+**, MySQL **8**
- (Tuỳ chọn) Docker Desktop
- Khóa API (đặt qua biến môi trường, **không commit**): Groq, Gemini, và Cloudflare R2/S3 nếu dùng lưu trữ đám mây (mặc định lưu local tại `uploads/`).

Sao chép `.env.example` thành `.env` rồi chỉnh các giá trị cần thiết.

---

## 💻 Chạy local (phát triển)

### 1. MySQL
Tạo database `englishlearning_db` (user `root`, cổng `3306`) – backend tự tạo schema khi khởi động. Hoặc dùng Docker:
```bash
docker compose up -d mysql   # MySQL ở localhost:3307
```

### 2. phonetics-service (cổng 8000)
```powershell
cd phonetics-service
.\.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload
```
Tài liệu API: http://localhost:8000/docs

### 3. writing-scorer (cổng 8001) – tuỳ chọn
```powershell
cd writing-scorer
pip install -r requirements.txt
python service.py
```
Nếu không chạy, đặt `python.writing-service.enabled=false` để dùng LLM.

### 4. Backend
```powershell
.\mvnw.cmd spring-boot:run
```
Swagger: http://localhost:8080/swagger-ui.html

### 5. Frontend
```powershell
cd frontend
npm install
npm run dev
```
Truy cập: http://localhost:5173

---

## 🐳 Chạy bằng Docker

```bash
docker compose up --build -d
docker compose ps
docker compose down
```

| Dịch vụ | Địa chỉ |
| :--- | :--- |
| Frontend (Nginx) | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| Swagger | http://localhost:8080/swagger-ui.html |
| Phonetics Service | http://localhost:8000/docs |
| MySQL | `localhost:3307` (root / root / `englishlearning_db`) |

> `docker-compose.yml` hiện gồm MySQL, phonetics-service, backend, frontend. Dịch vụ `writing-scorer` chạy riêng (xem mục trên).

**Chế độ Hybrid**: `docker compose up -d mysql phonetics-service` rồi chạy Backend/Frontend trên máy.

### Khác biệt Local và Docker

| Tiêu chí | Local | Docker |
| :--- | :--- | :--- |
| MySQL | `localhost:3306` | `mysql:3306` (host: `3307`) |
| Phonetics URL | `http://localhost:8000` | `http://phonetics-service:8000` |
| Frontend | `:5173` (Vite) | `:3000` (Nginx, proxy `/api/`) |

---

## 🧪 Kiểm thử

```powershell
# Backend (JUnit 5, Mockito, E2E)
.\mvnw.cmd test

# Frontend (Vitest)
cd frontend
npx vitest run
npx vite build

# phonetics-service (pytest)
cd phonetics-service
.\.venv\Scripts\python.exe -m pytest
```

---

## 📝 Ghi chú

- Âm thanh mẫu/Listening lưu tại `uploads/audio/` và phục vụ qua `/uploads/...`.
- Bí mật (API key, mật khẩu) chỉ đặt trong biến môi trường hoặc `.env`, không đưa vào git.
- Tài liệu thiết kế và sơ đồ nằm ở `docs/` và `plantuml_diagrams/`.
