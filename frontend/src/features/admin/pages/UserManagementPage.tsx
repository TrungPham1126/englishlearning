import { useEffect, useState, useTransition } from "react";
import { adminApi } from "@/features/admin/api/adminApi";
import type { UserSummaryDto, PageResponse } from "@/types/api";
import { Loader2, Plus, UserCheck, UserX, Trash2, Edit, X, Search, UserCog, GraduationCap, School, Shield, Users } from "lucide-react";

export default function UserManagementPage() {
  const [data, setData] = useState<PageResponse<UserSummaryDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [, startTransition] = useTransition();

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSummaryDto | null>(null);

  // Form States
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

  const fetchUsers = async (page = 0, role = roleFilter, keyword = searchKeyword) => {
    setLoading(true);
    try {
      const activeRole = role === "ALL" ? undefined : role;
      const res = await adminApi.getUsers(page, 50, activeRole, keyword);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(0, roleFilter, "");
  }, [roleFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      fetchUsers(0, roleFilter, searchKeyword);
    });
  };

  const handleToggleStatus = async (id: string, currentActive: boolean) => {
    if (
      !window.confirm(
        `Bạn muốn ${currentActive ? "KHÓA" : "MỞ KHÓA"} người dùng này?`,
      )
    )
      return;
    try {
      await adminApi.toggleUserStatus(id, !currentActive);
      fetchUsers(data?.pageNumber || 0, roleFilter, searchKeyword);
    } catch (err) {
      alert("Lỗi cập nhật trạng thái!");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("CẢNH BÁO: Xóa vĩnh viễn người dùng này?")) return;
    try {
      await adminApi.deleteUser(id);
      fetchUsers(data?.pageNumber || 0, roleFilter, searchKeyword);
    } catch (err) {
      alert("Lỗi khi xóa người dùng!");
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await adminApi.createUser(formData);
      alert("Tạo tài khoản thành công!");
      setIsCreateModalOpen(false);
      setFormData(initialForm);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi khi tạo user");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      await adminApi.updateUser(selectedUser.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        roles: formData.roles,
        isActive: true,
      });
      alert("Cập nhật thành công!");
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi khi cập nhật");
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (user: UserSummaryDto) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: "", // Không hiển thị pass cũ
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || "",
      roles: user.roles,
    });
    setIsEditModalOpen(true);
  };

  const toggleRole = (role: string) => {
    setFormData((prev) => {
      const roles = prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role];
      return { ...prev, roles };
    });
  };

  if (loading && !data)
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Clean Open Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800/80 bg-transparent">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50 mb-2">
            <Users size={14} />
            <span>Quản Trị Người Dùng</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Quản Lý Toàn Bộ Tài Khoản
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tổng số: <span className="font-semibold text-slate-900 dark:text-white">{data?.totalElements || 0}</span> tài khoản trên toàn hệ thống
          </p>
        </div>
        <button
          onClick={() => {
            setFormData(initialForm);
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-sm cursor-pointer text-sm"
        >
          <Plus size={18} /> Tạo Mới
        </button>
      </div>

      {/* FILTER TABS & SEARCH */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-[#121a2d] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-900 dark:text-slate-100">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {[
            { label: "Tất Cả", value: "ALL" },
            { label: "Học Viên", value: "ROLE_STUDENT" },
            { label: "Giảng Viên", value: "ROLE_TEACHER" },
            { label: "Quản Trị Viên", value: "ROLE_ADMIN" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setRoleFilter(tab.value)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                roleFilter === tab.value
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-80">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm theo tên, email, SĐT..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0d1322] text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-indigo-600"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Tìm
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-[#121a2d] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black border-b border-slate-200 dark:border-slate-800">
                <th className="p-4">Họ & Tên</th>
                <th className="p-4">Liên hệ (Email & SĐT)</th>
                <th className="p-4">Vai trò (Roles)</th>
                <th className="p-4 text-center">Trạng thái</th>
                <th className="p-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
              {data?.content.map((user) => {
                const isActive = user.isActive !== false;
                return (
                <tr key={user.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/70 transition">
                  <td className="p-4 font-bold text-slate-900 dark:text-white">
                    {user.lastName} {user.firstName}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">
                    <div className="font-semibold text-indigo-700 dark:text-indigo-400">
                      {user.email}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {user.phone || "Chưa có SĐT"}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1.5 flex-wrap">
                      {user.roles.map((r) => (
                        <span
                          key={r}
                          className="px-2 py-1 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded uppercase border border-indigo-100 dark:border-indigo-500/30"
                        >
                          {r.replace("ROLE_", "")}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleToggleStatus(user.id, isActive)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                        isActive
                          ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                          : "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
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
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(user)}
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-100 hover:text-indigo-600 rounded-lg transition cursor-pointer"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-100 hover:text-rose-600 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL TẠO MỚI / CHỈNH SỬA USER */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#121a2d] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/60">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {isCreateModalOpen ? "Tạo Tài Khoản Mới" : "Cập Nhật Tài Khoản"}
              </h2>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={
                isCreateModalOpen ? handleCreateSubmit : handleEditSubmit
              }
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Họ
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full border-2 border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-600 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full border-2 border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-600 text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email
                </label>
                <input
                  required
                  type="email"
                  disabled={isEditModalOpen}
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full border-2 border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-600 text-sm font-semibold disabled:bg-slate-100"
                />
              </div>

              {isCreateModalOpen && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Mật khẩu khởi tạo
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, password: "Password@123" }))}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      Dùng mặc định: Password@123
                    </button>
                  </div>
                  <input
                    required
                    type="text"
                    placeholder="vd: Password@123"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full border-2 border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-600 text-sm font-semibold"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Tối thiểu 8 ký tự gồm chữ hoa, chữ thường, số hoặc ký tự đặc biệt.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  placeholder="0912345678"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full border-2 border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-600 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Vai trò tài khoản (Chọn quyền cấp phát)
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { role: "ROLE_STUDENT", label: "Học Viên", icon: GraduationCap, desc: "Truy cập khóa học & làm bài" },
                    { role: "ROLE_TEACHER", label: "Giảng Viên", icon: School, desc: "Quản lý lớp & tạo bài tập" },
                    { role: "ROLE_ADMIN", label: "Quản Trị", icon: Shield, desc: "Toàn quyền quản trị hệ thống" },
                  ].map((item) => {
                    const isChecked = formData.roles.includes(item.role);
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.role}
                        onClick={() => toggleRole(item.role)}
                        className={`flex flex-col items-center text-center p-3 rounded-xl border-2 cursor-pointer transition select-none ${
                          isChecked
                            ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-xs"
                            : "border-slate-200 hover:border-slate-300 text-slate-600"
                        }`}
                      >
                        <Icon size={20} className={isChecked ? "text-indigo-600 mb-1" : "text-slate-400 mb-1"} />
                        <span className="text-xs font-black">{item.label}</span>
                        <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">{item.desc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving || formData.roles.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer disabled:opacity-50 transition shadow-sm"
                >
                  {isSaving && <Loader2 size={16} className="animate-spin" />}{" "}
                  Lưu Tài Khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
