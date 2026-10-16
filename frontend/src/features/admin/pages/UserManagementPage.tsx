import { useEffect, useState, useTransition } from "react";
import { adminApi } from "@/features/admin/api/adminApi";
import type { UserSummaryDto, PageResponse } from "@/types/api";
import { Loader2, Plus, UserCheck, UserX, Trash2, Edit, X, Search, UserCog } from "lucide-react";

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-800">
            Quản Lý Toàn Bộ Tài Khoản
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tổng số: {data?.totalElements || 0} tài khoản trên toàn hệ thống
          </p>
        </div>
        <button
          onClick={() => {
            setFormData(initialForm);
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-sm cursor-pointer text-sm"
        >
          <Plus size={18} /> Tạo Mới
        </button>
      </div>

      {/* FILTER TABS & SEARCH */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
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
                  : "text-slate-600 hover:bg-slate-100"
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
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 outline-none focus:border-indigo-600"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Tìm
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-black border-b border-slate-200">
                <th className="p-4">Họ & Tên</th>
                <th className="p-4">Liên hệ (Email & SĐT)</th>
                <th className="p-4">Vai trò (Roles)</th>
                <th className="p-4 text-center">Trạng thái</th>
                <th className="p-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {data?.content.map((user) => {
                const isActive = user.isActive !== false;
                return (
                <tr key={user.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-bold text-slate-800">
                    {user.lastName} {user.firstName}
                  </td>
                  <td className="p-4 text-slate-600">
                    <div className="font-semibold text-indigo-700">
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
                          className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase border border-indigo-100"
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
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                          : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
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
                      className="p-2 bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-600 rounded-lg transition cursor-pointer"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="p-2 bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600 rounded-lg transition cursor-pointer"
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-black text-slate-800">
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mật khẩu (Tối thiểu 8 ký tự, có hoa/thường/số)
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full border-2 border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-600 text-sm font-semibold"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full border-2 border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-600 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Phân quyền (Roles)
                </label>
                <div className="flex gap-4">
                  {["ROLE_STUDENT", "ROLE_TEACHER", "ROLE_ADMIN"].map(
                    (role) => (
                      <label
                        key={role}
                        className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={formData.roles.includes(role)}
                          onChange={() => toggleRole(role)}
                          className="w-4 h-4 accent-indigo-600"
                        />
                        {role.replace("ROLE_", "")}
                      </label>
                    ),
                  )}
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
