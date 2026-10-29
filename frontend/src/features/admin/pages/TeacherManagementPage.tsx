// src/features/admin/pages/TeacherManagementPage.tsx
import { useEffect, useState, useTransition } from "react";
import { adminApi } from "@/features/admin/api/adminApi";
import type { UserSummaryDto, PageResponse } from "@/types/api";
import type { ClassroomResponse } from "@/features/admin/types";
import {
  Loader2,
  Plus,
  Search,
  GraduationCap,
  School,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  X,
  Shield,
  Phone,
  Mail,
  BookOpen,
} from "lucide-react";

export default function TeacherManagementPage() {
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
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<UserSummaryDto | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");

  // Form State
  const initialForm = {
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    roles: ["ROLE_TEACHER"],
  };
  const [formData, setFormData] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTeachers = async (page = 0, keyword = searchKeyword) => {
    setLoading(true);
    try {
      const [userRes, classRes] = await Promise.all([
        adminApi.getUsers(page, 20, "ROLE_TEACHER", keyword),
        adminApi.getClassrooms(0, 100),
      ]);
      setData(userRes);
      setClasses(classRes.content);
    } catch (err) {
      console.error("Lỗi lấy danh sách giảng viên", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers(0, "");
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      fetchTeachers(0, searchKeyword);
    });
  };

  const handleToggleStatus = async (user: UserSummaryDto) => {
    const nextStatus = !user.isActive;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn ${nextStatus ? "MỞ KHÓA" : "TẠM KHÓA"} tài khoản giảng viên "${user.lastName} ${user.firstName}"?`,
      )
    )
      return;
    try {
      await adminApi.toggleUserStatus(user.id, nextStatus);
      fetchTeachers(data.pageNumber, searchKeyword);
    } catch (err) {
      alert("Lỗi khi cập nhật trạng thái giảng viên!");
    }
  };

  const handleDelete = async (user: UserSummaryDto) => {
    if (
      !window.confirm(
        `CẢNH BÁO: Xóa vĩnh viễn tài khoản giảng viên "${user.lastName} ${user.firstName}"?`,
      )
    )
      return;
    try {
      await adminApi.deleteUser(user.id);
      fetchTeachers(data.pageNumber, searchKeyword);
    } catch (err) {
      alert("Không thể xóa giảng viên đang phụ trách lớp học hoặc có dữ liệu liên kết!");
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await adminApi.createUser({
        ...formData,
        roles: ["ROLE_TEACHER"],
      });
      alert("Tạo tài khoản giảng viên thành công!");
      setIsCreateModalOpen(false);
      setFormData(initialForm);
      fetchTeachers(0, "");
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi khi tạo tài khoản");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;
    setIsSaving(true);
    try {
      await adminApi.updateUser(selectedTeacher.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        roles: ["ROLE_TEACHER"],
        isActive: selectedTeacher.isActive ?? true,
      });
      alert("Cập nhật thông tin giảng viên thành công!");
      setIsEditModalOpen(false);
      fetchTeachers(data.pageNumber, searchKeyword);
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi cập nhật giảng viên");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher || !selectedClassId) return;
    setIsSaving(true);
    try {
      await adminApi.assignTeacher(selectedClassId, selectedTeacher.id);
      alert("Phân công giảng viên cho lớp học thành công!");
      setIsAssignModalOpen(false);
      setSelectedClassId("");
      fetchTeachers(data.pageNumber, searchKeyword);
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi khi phân công giảng viên");
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (teacher: UserSummaryDto) => {
    setSelectedTeacher(teacher);
    setFormData({
      email: teacher.email,
      password: "",
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      phone: teacher.phone || "",
      roles: ["ROLE_TEACHER"],
    });
    setIsEditModalOpen(true);
  };

  const openAssignModal = (teacher: UserSummaryDto) => {
    setSelectedTeacher(teacher);
    setSelectedClassId("");
    setIsAssignModalOpen(true);
  };

  // Lấy danh sách các lớp giảng viên đang phụ trách
  const getTeacherClasses = (teacherId: string) => {
    return classes.filter((c) => c.teacherId === teacherId);
  };

  const activeCount = data.content.filter((u) => u.isActive !== false).length;
  const lockedCount = data.content.filter((u) => u.isActive === false).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* 1. CLEAN OPEN HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-slate-900/40 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50 mb-2">
            <GraduationCap size={14} />
            <span>Đội Ngũ Sư Phạm</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Quản Lý Đội Ngũ Giảng Viên
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Hồ sơ giảng viên, lớp đang phụ trách và phân công giảng dạy cho trung tâm.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setFormData(initialForm);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-blue-800 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-sm cursor-pointer text-sm"
          >
            <Plus size={18} /> Thêm Giảng Viên Mới
          </button>
        </div>
      </div>

      {/* 2. STATS & SEARCH BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-600/15 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold">
            <GraduationCap size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">Tổng giảng viên</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">{data.totalElements}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <UserCheck size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">Đang hoạt động</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{activeCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
            <UserX size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">Tạm khóa</span>
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
              placeholder="Tìm theo tên, email, SĐT..."
              className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1120] text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-700 shadow-sm"
            />
          </div>
          <button
            type="submit"
            className="px-4 bg-blue-800 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Lọc
          </button>
        </form>
      </div>

      {/* 3. TEACHER TABLE */}
      <div className="bg-white dark:bg-[#111827] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="animate-spin text-blue-700 mb-2" size={32} />
            <p className="text-xs font-semibold">Đang tải danh sách giảng viên...</p>
          </div>
        ) : data.content.length === 0 ? (
          <div className="p-16 text-center text-slate-500 dark:text-slate-400">
            <GraduationCap size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h4 className="text-base font-bold text-slate-800 dark:text-white">Không tìm thấy giảng viên</h4>
            <p className="text-xs text-slate-400 mt-1">
              Thử tìm kiếm với từ khóa khác hoặc bấm "Thêm Giảng Viên Mới".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#162033] text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black border-b border-slate-200 dark:border-slate-800">
                  <th className="p-4 pl-6">Giảng Viên</th>
                  <th className="p-4">Liên Hệ</th>
                  <th className="p-4">Lớp Học Phụ Trách</th>
                  <th className="p-4 text-center">Trạng Thái</th>
                  <th className="p-4 pr-6 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {data.content.map((teacher) => {
                  const teacherClasses = getTeacherClasses(teacher.id);
                  const isActive = teacher.isActive !== false;
                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300 font-black flex items-center justify-center text-sm shadow-inner shrink-0">
                            {teacher.firstName?.charAt(0) || "T"}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {teacher.lastName} {teacher.firstName}
                            </p>
                            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-600/15 px-2 py-0.5 rounded-full inline-block mt-0.5">
                              Giảng Viên ELP
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                          <Mail size={13} className="text-slate-400" /> {teacher.email}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <Phone size={13} className="text-slate-400" /> {teacher.phone || "Chưa cập nhật"}
                        </div>
                      </td>

                      <td className="p-4">
                        {teacherClasses.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">
                            Chưa phân công lớp
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {teacherClasses.map((cls) => (
                              <span
                                key={cls.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-[#162033] text-slate-800 dark:text-slate-100 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700"
                              >
                                <School size={12} className="text-blue-700 dark:text-blue-400" />
                                {cls.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(teacher)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
                            isActive
                              ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                              : "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
                          }`}
                        >
                          {isActive ? (
                            <>
                              <UserCheck size={14} /> Hoạt Động
                            </>
                          ) : (
                            <>
                              <UserX size={14} /> Đã Khóa
                            </>
                          )}
                        </button>
                      </td>

                      <td className="p-4 pr-6 text-right space-x-2">
                        <button
                          onClick={() => openAssignModal(teacher)}
                          title="Phân công lớp học"
                          className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-600/15 text-blue-800 dark:text-blue-300 hover:bg-blue-800 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          Gán Lớp
                        </button>
                        <button
                          onClick={() => openEditModal(teacher)}
                          title="Chỉnh sửa thông tin"
                          className="p-2 bg-slate-100 dark:bg-[#162033] text-slate-600 dark:text-slate-300 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition cursor-pointer"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(teacher)}
                          title="Xóa tài khoản"
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

      {/* MODAL 1: TẠO GIẢNG VIÊN MỚI */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-elevated w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <GraduationCap className="text-blue-700" /> Thêm Giảng Viên Mới
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
                    Họ & Đệm
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-2.5 outline-none focus:border-blue-700 text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="Nguyễn Văn"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tên Giảng Viên
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-2.5 outline-none focus:border-blue-700 text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="An"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email Đăng Nhập
                </label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-2.5 outline-none focus:border-blue-700 text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder="teacher@center.edu.vn"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mật Khẩu Ban Đầu (Tối thiểu 8 ký tự, có hoa/thường/số)
                </label>
                <input
                  required
                  type="text"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-2.5 outline-none focus:border-blue-700 text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder="Teacher@123"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Số Điện Thoại
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-2.5 outline-none focus:border-blue-700 text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder="0912345678"
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
                  {isSaving && <Loader2 size={16} className="animate-spin" />} Lưu Giảng Viên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CHỈNH SỬA GIẢNG VIÊN */}
      {isEditModalOpen && selectedTeacher && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-elevated w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Edit className="text-blue-700" /> Cập Nhật Hồ Sơ Giảng Viên
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
                    Họ & Đệm
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
                  Email (Không đổi)
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
                  Số Điện Thoại
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
                  {isSaving && <Loader2 size={16} className="animate-spin" />} Cập Nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GÁN GIẢNG VIÊN VÀO LỚP HỌC */}
      {isAssignModalOpen && selectedTeacher && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-elevated w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <School className="text-blue-700" /> Phân Công Giảng Dạy
              </h2>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-6 space-y-4">
              <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100">
                <span className="text-xs font-semibold text-slate-500 block">Giảng viên được chọn:</span>
                <span className="text-sm font-bold text-blue-900 block mt-0.5">
                  {selectedTeacher.lastName} {selectedTeacher.firstName} ({selectedTeacher.email})
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Chọn Lớp Học Phụ Trách
                </label>
                <select
                  required
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-3 outline-none focus:border-blue-700 text-sm font-bold"
                >
                  <option value="" disabled>-- Vui lòng chọn lớp học --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} (Level: {cls.level}) - {cls.teacherName ? `Hiện tại: ${cls.teacherName}` : "Chưa có GV"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !selectedClassId}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-blue-800 hover:bg-blue-800 cursor-pointer disabled:opacity-50 text-xs shadow-sm"
                >
                  {isSaving && <Loader2 size={16} className="animate-spin" />} Xác Nhận Phân Công
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

