with open('updated_doc.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Figures list for Chapter 2
ch2_figs = """
**Hình 2.1**: Sơ đồ kiến trúc tổng thể hệ thống (Modular Monolith Spring Boot & Python FastAPI)

**Hình 2.2**: Sơ đồ cơ chế giao tiếp liên dịch vụ (REST, RabbitMQ, WebSocket STOMP, Cloudflare R2)

**Hình 2.3**: Luồng xử lý dữ liệu và cơ chế dự phòng đa tầng (3-Tier AI Fallback Pipeline)

**Hình 2.4**: Biểu đồ tuần tự nghiệp vụ Đăng nhập và Làm mới phiên xác thực (UC-AUTH-01)

**Hình 2.5**: Biểu đồ tuần tự nghiệp vụ Luyện phát âm Shadowing qua dịch vụ âm học và AI (UC-AI-01)

**Hình 2.6**: Biểu đồ tuần tự nghiệp vụ Khởi tạo bài tập thông minh AI / Excel / TTS (UC-TEA-01)

**Hình 2.7**: Biểu đồ tuần tự nghiệp vụ Làm bài tập CBT và Chấm bài tự luận/nói bằng AI (UC-STU-01)

**Hình 2.8**: Biểu đồ tuần tự nghiệp vụ Tải lên và Chuyển đổi Video HLS bất đồng bộ qua RabbitMQ (UC-SYS-01)

**Hình 2.9**: Biểu đồ lớp chi tiết của miền dữ liệu cốt lõi (Core Domain Model)

**Hình 2.10**: Sơ đồ quan hệ thực thể (ERD) toàn diện của cơ sở dữ liệu hệ thống (32 thực thể)

**Hình 2.11**: Kiến trúc Frontend React SPA, phân quyền định tuyến và quản lý trạng thái Zustand

**Hình 2.12**: Sơ đồ luồng tương tác thời gian thực thu âm Audio và phản hồi WebSocket

### **DANH MỤC CÁC BẢNG BIỂU**

**Bảng 2.1**: Phân định trách nhiệm giữa Modular Monolith Spring Boot và Microservice Python FastAPI

**Bảng 2.2**: So sánh đặc tính các giao thức giao tiếp nội bộ và ngoại vi trong hệ thống

**Bảng 2.3**: Đặc tả các tầng trong kiến trúc phân tích phát âm đa tầng (3-Tier AI Fallback)

**Bảng 2.4**: Đặc tả các mô-đun nghiệp vụ Backend Spring Boot và Python Phonetics Pipeline

**Bảng 2.5**: Bảng từ điển dữ liệu nhóm Xác thực, Phân quyền & Người dùng

**Bảng 2.6**: Bảng từ điển dữ liệu nhóm Lớp học, Học liệu & Lộ trình ngày

**Bảng 2.7**: Bảng từ điển dữ liệu nhóm Khảo thí CBT & Lượt làm bài

**Bảng 2.8**: Bảng từ điển dữ liệu nhóm Đánh giá AI, Kỹ năng CEFR & Media

**Bảng 2.9**: Đặc tả hợp đồng giao tiếp RESTful API cốt lõi

**Bảng 2.10**: Đặc tả các luồng màn hình chính và thành phần giao diện Frontend React theo vai trò
"""

target_marker = "* **Hình 1.11**: Sơ đồ hoạt động của Use Case Tải lên và chuyển đổi Video bài giảng sang luồng HLS bất đồng bộ (UC-SYS-01)"
if target_marker in text:
    text = text.replace(target_marker, target_marker + "\n" + ch2_figs.strip())
    print("Added Chapter 2 figures and tables to TOC header successfully.")
else:
    print("Could not find target marker for TOC.")

with open('updated_doc.md', 'w', encoding='utf-8') as f:
    f.write(text)
