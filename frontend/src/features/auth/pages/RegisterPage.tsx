// src/features/auth/pages/RegisterPage.tsx
import { useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { axiosClient } from "@/lib/axiosClient";
import type { ApiResponse, UserSummaryDto } from "@/types/api";
import {
  User,
  Mail,
  Lock,
  Phone,
  GraduationCap,
  School,
  Loader2,
  AlertCircle,
} from "lucide-react";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    role: "ROLE_STUDENT" as "ROLE_STUDENT" | "ROLE_TEACHER",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await axiosClient.post<ApiResponse<UserSummaryDto>>(
        "/api/v1/auth/register",
        formData,
      );
      alert("Đăng ký tài khoản thành công! Vui lòng đăng nhập.");
      navigate("/login");
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Đăng ký thất bại. Mật khẩu cần tối thiểu 8 ký tự gồm chữ hoa, chữ thường, số và ký tự đặc biệt.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-800">
            Tạo Tài Khoản Mới
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gia nhập nền tảng học tiếng Anh trực tuyến
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Họ
              </label>
              <input
                required
                type="text"
                name="lastName"
                placeholder="Nguyễn"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên
              </label>
              <input
                required
                type="text"
                name="firstName"
                placeholder="Văn A"
                value={formData.firstName}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Địa chỉ Email
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail size={16} />
              </span>
              <input
                required
                type="email"
                name="email"
                placeholder="email@example.com"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Số điện thoại
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Phone size={16} />
              </span>
              <input
                type="tel"
                name="phone"
                placeholder="0912345678"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mật khẩu
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock size={16} />
              </span>
              <input
                required
                type="password"
                name="password"
                placeholder="Tối thiểu 8 ký tự (hoa, thường, số, ký tự đặc biệt)"
                value={formData.password}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Vai trò tài khoản
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold cursor-pointer transition ${
                  formData.role === "ROLE_STUDENT"
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="ROLE_STUDENT"
                  checked={formData.role === "ROLE_STUDENT"}
                  onChange={handleChange}
                  className="hidden"
                />
                <GraduationCap size={16} /> Học Viên
              </label>
              <label
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold cursor-pointer transition ${
                  formData.role === "ROLE_TEACHER"
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="ROLE_TEACHER"
                  checked={formData.role === "ROLE_TEACHER"}
                  onChange={handleChange}
                  className="hidden"
                />
                <School size={16} /> Giảng Viên
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "Đăng Ký Tài Khoản"
            )}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-slate-500">
          Đã có tài khoản?{" "}
          <Link
            to="/login"
            className="font-semibold text-indigo-600 hover:underline"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </div>
  );
}
