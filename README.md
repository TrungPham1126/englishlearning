# English Learning Platform (Monorepo)

Dự án Nền tảng Học tiếng Anh Thông minh tích hợp Trí tuệ Nhân tạo (AI). Cấu trúc Monorepo hợp nhất toàn bộ mã nguồn: Backend (Java Spring Boot 3), Frontend (React + Vite), và AI Phonetics Service (FastAPI + PyTorch).

Hỗ trợ **chạy kép (Dual Mode)**: Bạn có thể chạy **hoàn toàn bằng Docker** hoặc **chạy Local trên máy** mà không cần sửa code!

---

## 📂 Cấu Trúc Thư Mục Monorepo

```text
englishlearning/
├── src/                      # Backend Core: Java Spring Boot 3, REST APIs, Security, Business Logic
├── pom.xml                   # Maven dependencies & build configuration
├── Dockerfile                # Multi-stage Dockerfile cho Backend Spring Boot
├── docker-compose.yml        # Docker Compose khởi chạy toàn bộ 4 dịch vụ (MySQL, Backend, Frontend, AI)
├── .env.example              # Mẫu biến môi trường cho Docker & Local
├── frontend/                 # Frontend Web App: React 19, Vite, TypeScript, TailwindCSS
│   ├── src/
│   ├── package.json
│   ├── Dockerfile            # Multi-stage Dockerfile với Nginx SPA & API Reverse Proxy
│   ├── nginx.conf            # Nginx config điều hướng API sang backend
│   └── vite.config.ts
├── phonetics-service/        # AI Service: FastAPI, PyTorch (Wav2Vec2, Forced Alignment, Kokoro TTS)
│   ├── app/
│   ├── requirements.txt
│   └── Dockerfile            # Dockerfile cho Python Speech Engine
├── scripts/                  # Database migration & utility scripts
├── .gitignore                # Cấu hình bỏ qua file rác & artifacts cho cả 3 nền tảng
└── README.md
```

---

## 🐳 CÁCH 1: KHỞI CHẠY BẰNG DOCKER (KHUYÊN DÙNG CHO DEPLOY & DEMO)

Chỉ cần cài đặt Docker Desktop, toàn bộ 4 dịch vụ (MySQL, AI Service, Backend, Frontend) sẽ tự động liên kết với nhau qua mạng nội bộ Docker.

### 1. Khởi chạy tất cả dịch vụ
```bash
# Đứng tại thư mục gốc englishlearning
docker compose up --build -d
```

### 2. Kiểm tra trạng thái các container
```bash
docker compose ps
```

### 3. Cổng truy cập các dịch vụ trong Docker:
* 🌐 **Frontend Web**: [http://localhost:3000](http://localhost:3000) (hoặc [http://localhost:5173](http://localhost:5173) nếu chỉnh trong `.env`)
* ⚙️ **Backend API**: [http://localhost:8080](http://localhost:8080)
* 📖 **Swagger API Docs**: [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
* 🎙️ **AI Phonetics Service**: [http://localhost:8000/docs](http://localhost:8000/docs)
* 🗄️ **MySQL Database**: `localhost:3307` (user: `root`, password: `root`, database: `englishlearning_db`)

### 4. Dừng toàn bộ hệ thống
```bash
docker compose down
```

---

## 💻 CÁCH 2: KHỞI CHẠY TRỰC TIẾP TRÊN MÁY (LOCAL DEVELOPMENT)

Dành cho quá trình phát triển, chỉnh sửa mã nguồn có Hot-Reloading.

### 1. Cơ sở dữ liệu (MySQL)
* Đảm bảo MySQL cục bộ đang chạy trên cổng `3306` (database: `englishlearning_db`, user: `root`).
* *Hoặc bạn có thể dùng Docker để chạy riêng MySQL:*
  ```bash
  docker compose up -d mysql
  ```

### 2. Dịch vụ AI Python (`phonetics-service`)
* Mở terminal tại thư mục `phonetics-service`:
  ```powershell
  cd phonetics-service
  .\.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload
  ```
* Truy cập tài liệu API: [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Backend Spring Boot 3
* Mở terminal tại thư mục gốc `englishlearning`:
  ```powershell
  .\mvnw.cmd spring-boot:run
  ```
* Backend tự động kết nối MySQL tại `localhost:3306` và AI Service tại `localhost:8000`.

### 4. Frontend React Vite
* Mở terminal tại thư mục `frontend`:
  ```powershell
  cd frontend
  npm run dev
  ```
* Truy cập giao diện ứng dụng: [http://localhost:5173](http://localhost:5173)

---

## 🔀 CÁCH 3: CHẾ ĐỘ HYBRID (KẾT HỢP DOCKER & LOCAL)
Bạn có thể chạy các dịch vụ phụ thuộc nặng (MySQL và AI Python) bằng Docker, trong khi code Backend và Frontend vẫn chạy Local để chỉnh sửa code nhận ngay:
```bash
# 1. Chạy MySQL và AI Service bằng Docker:
docker compose up -d mysql phonetics-service

# 2. Chạy Backend & Frontend trên máy như bình thường:
.\mvnw.cmd spring-boot:run
cd frontend && npm run dev
```

---

## 🛡️ Điểm Khác Biệt Giữa 2 Chế Độ

| Tiêu chí | Chế độ Local | Chế độ Docker |
| :--- | :--- | :--- |
| **MySQL Host** | `localhost:3306` | `mysql:3306` (Internal), `localhost:3307` (Host) |
| **Phonetics Service URL** | `http://localhost:8000` | `http://phonetics-service:8000` |
| **Frontend Web** | `http://localhost:5173` (Vite dev) | `http://localhost:3000` (Nginx production) |
| **CORS** | Tự động cho phép localhost mọi port | Nginx tự động reverse proxy qua `/api/` |
