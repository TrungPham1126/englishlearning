// src/features/admin/pages/StudentManagementPage.tsx
import { useEffect, useState, useTransition } from "react";
import { adminApi } from "@/features/admin/api/adminApi";
import type { UserSummaryDto, PageResponse } from "@/types/api";
import type { ClassroomResponse } from "@/features/admin/types";
import {
  Loader2,
  Plus,
  Search,
  Users,
  School,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  X,
  Phone,
  Mail,
  UserPlus,
  GraduationCap,
} from "lucide-react";

export default function StudentManagementPage() {
  const [data, setData] = useState<PageResponse<UserSummaryDto>>({
    content: [],
    pageNumber: 0,
    pageSize: 20,
    totalElements: 0,
    totalPages: 0,
    last: true,
  });
  const [classes, setClasses] = useState<ClassroomResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [, startTransition] = useTransition();

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<UserSummaryDto | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");

  // Form State
  const initialForm = {
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    roles: ["ROLE_STUDENT"],
  };
  const [formData, setFormData] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);

  const fetchStudents = async (page = 0, keyword = searchKeyword) => {
    setLoading(true);
    try {
      const [userRes, classRes] = await Promise.all([
        adminApi.getUsers(page, 20, "ROLE_STUDENT", keyword),
        adminApi.getClassrooms(0, 100),
      ]);
      setData(userRes);
      setClasses(classRes.content);
    } catch (err) {
      console.error("Lỗi lấy danh sách học viên", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents(0, "");
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      fetchStudents(0, searchKeyword);
    });
  };

  const handleToggleStatus = async (user: UserSummaryDto) => {
    const nextStatus = !user.isActive;
    if (
      !window.confirm(
        `${nextStatus ? "Mở khóa" : "Khóa"} học viên "${user.firstName} ${user.lastName}"?`,
      )
    )
      return;
    try {
      await adminApi.toggleUserStatus(user.id, nextStatus);
      fetchStudents(data.pageNumber, searchKeyword);
    } catch (err) {
      alert("Cập nhật trạng thái thất bại.");
    }
  };

  const handleDelete = async (user: UserSummaryDto) => {
    if (
      !window.confirm(
        `Xóa vĩnh viễn học viên "${user.firstName} ${user.lastName}"?`,
      )
    )
      return;
    try {
      await adminApi.deleteUser(user.id);
      fetchStudents(data.pageNumber, searchKeyword);
    } catch (err) {
      alert("Không thể xóa học viên đang có dữ liệu học tập.");
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await adminApi.createUser({
        ...formData,
        roles: ["ROLE_STUDENT"],
      });
      alert("Đã tạo học viên.");
      setIsCreateModalOpen(false);
      setFormData(initialForm);
      fetchStudents(0, "");
    } catch (err: any) {
      alert(err.response?.data?.message || "Tạo học viên thất bại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setIsSaving(true);
    try {
      await adminApi.updateUser(selectedStudent.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        roles: ["ROLE_STUDENT"],
        isActive: selectedStudent.isActive ?? true,
      });
      alert("Đã cập nhật học viên.");
      setIsEditModalOpen(false);
      fetchStudents(data.pageNumber, searchKeyword);
    } catch (err: any) {
      alert(err.response?.data?.message || "Cập nhật thất bại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedClassId) return;
    setIsSaving(true);
    try {
      await adminApi.enrollStudent(selectedClassId, selectedStudent.email);
      alert("Đã ghi danh vào lớp.");
      setIsEnrollModalOpen(false);
      setSelectedClassId("");
    } catch (err: any) {
      alert(err.response?.data?.message || "Học viên đã có trong lớp hoặc lớp đã đầy.");
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (student: UserSummaryDto) => {
    setSelectedStudent(student);
    setFormData({
      email: student.email,
      password: "",
      firstName: student.firstName,
      lastName: student.lastName,
      phone: student.phone || "",
      roles: ["ROLE_STUDENT"],
    });
    setIsEditModalOpen(true);
  };

  const openEnrollModal = (student: UserSummaryDto) => {
    setSelectedStudent(student);
    setSelectedClassId("");
    setIsEnrollModalOpen(true);
  };

  const activeCount = data.content.filter((u) => u.isActive !== false).length;
  const lockedCount = data.content.filter((u) => u.isActive === false).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* 1. CLEAN OPEN HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Học viên
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setFormData(initialForm);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-blue-800 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-sm cursor-pointer text-sm"
          >
            <Plus size={18} /> Thêm học viên
          </button>
        </div>
      </div>

      {/* 2. STATS & SEARCH */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-600/15 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold">
            <Users size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">Tổng số</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">{data.totalElements}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <UserCheck size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">Đang học</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{activeCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
            <UserX size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">Đã khóa</span>
            <span className="text-xl font-black text-rose-600 dark:text-rose-400">{lockedCount}</span>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm tên, email, SĐT..."
              className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-700 shadow-sm"
            />
          </div>
          <button
            type="submit"
            className="px-4 bg-blue-800 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Tìm
          </button>
        </form>
      </div>

      {/* 3. STUDENT TABLE */}
      <div className="bg-white dark:bg-[#111827] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="animate-spin text-blue-700 mb-2" size={32} />
            <p className="text-xs font-semibold">Đang tải...</p>
          </div>
        ) : data.content.length === 0 ? (
          <div className="p-16 text-center text-slate-500 dark:text-slate-400">
            <Users size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h4 className="text-base font-bold text-slate-800 dark:text-white">Chưa có dữ liệu</h4>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#162033] text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black border-b border-slate-200 dark:border-slate-800">
                  <th className="p-4 pl-6">Học viên</th>
                  <th className="p-4">Liên hệ</th>
                  <th className="p-4 text-center">Trạng thái</th>
                  <th className="p-4 pr-6 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {data.content.map((student) => {
                  const isActive = student.isActive !== false;
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-black flex items-center justify-center text-sm shadow-inner shrink-0">
                            {student.firstName?.charAt(0) || "S"}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {student.firstName} {student.lastName}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                          <Mail size={13} className="text-slate-400" /> {student.email}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <Phone size={13} className="text-slate-400" /> {student.phone || "Chưa có SĐT"}
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(student)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold border transition cursor-pointer ${
                            isActive
                              ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                              : "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
                          }`}
                        >
                          {isActive ? (
                            <>
                              <UserCheck size={14} /> Hoạt động
                            </>
                          ) : (
                            <>
                              <UserX size={14} /> Đã khóa
                            </>
                          )}
                        </button>
                      </td>

                      <td className="p-4 pr-6 text-right space-x-2">
                        <button
                          onClick={() => openEnrollModal(student)}
                          title="Ghi danh"
                          className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Ghi danh
                        </button>
                        <button
                          onClick={() => openEditModal(student)}
                          title="Sửa"
                          className="p-2 bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-300 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition cursor-pointer"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(student)}
                          title="Xóa"
                          className="p-2 bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-300 hover:bg-rose-100 hover:text-rose-600 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: TẠO HỌC VIÊN MỚI */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-elevated w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <UserPlus className="text-blue-700" /> Thêm học viên
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Họ
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-2.5 outline-none focus:border-blue-700 text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="Trần Thị"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tên
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-2.5 outline-none focus:border-blue-700 text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="Bình"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-2.5 outline-none focus:border-blue-700 text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder="student@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mật khẩu
                </label>
                <input
                  required
                  type="text"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-2.5 outline-none focus:border-blue-700 text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder="Student@123"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Tối thiểu 8 ký tự (hoa, thường, số).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-2.5 outline-none focus:border-blue-700 text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder="0987654321"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-blue-800 hover:bg-blue-800 cursor-pointer disabled:opacity-50 text-xs shadow-sm"
                >
                  {isSaving && <Loader2 size={16} className="animate-spin" />} Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SỬA HỌC VIÊN */}
      {isEditModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-elevated w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Edit className="text-blue-700" /> Sửa học viên
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Họ
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-2.5 outline-none focus:border-blue-700 text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tên
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-2.5 outline-none focus:border-blue-700 text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  disabled
                  type="email"
                  value={formData.email}
                  className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-2.5 outline-none focus:border-blue-700 text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-blue-800 hover:bg-blue-800 cursor-pointer disabled:opacity-50 text-xs shadow-sm"
                >
                  {isSaving && <Loader2 size={16} className="animate-spin" />} Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GHI DANH HỌC VIÊN VÀO LỚP HỌC */}
      {isEnrollModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-elevated w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <School className="text-emerald-600" /> Ghi danh lớp
              </h2>
              <button
                onClick={() => setIsEnrollModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEnrollSubmit} className="p-6 space-y-4">
              <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-100">
                <span className="text-xs font-semibold text-slate-500 block">Học viên</span>
                <span className="text-sm font-bold text-emerald-950 block mt-0.5">
                  {selectedStudent.firstName} {selectedStudent.lastName} ({selectedStudent.email})
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Lớp học
                </label>
                <select
                  required
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-3 outline-none focus:border-blue-700 text-sm font-bold"
                >
                  <option value="" disabled>-- Chọn lớp --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.level}) · {cls.currentStudentsCount}/{cls.maxStudents || "∞"} ({cls.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !selectedClassId}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer disabled:opacity-50 text-xs shadow-sm"
                >
                  {isSaving && <Loader2 size={16} className="animate-spin" />} Ghi danh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

