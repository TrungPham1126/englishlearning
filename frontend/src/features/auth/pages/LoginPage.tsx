import { useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { authApi } from "../api/authApi";
import type { LoginFormData, FormErrors } from "../types";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  BookOpen,
} from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      nextErrors.email = "Vui lòng nhập địa chỉ email";
    } else if (!emailRegex.test(formData.email.trim())) {
      nextErrors.email = "Email không đúng định dạng";
    }
    if (!formData.password) {
      nextErrors.password = "Vui lòng nhập mật khẩu";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate() || isLoading) return;
    setIsLoading(true);
    setErrors({});
    try {
      const authData = await authApi.login({
        email: formData.email.trim(),
        password: formData.password,
      });

      // Lưu Access Token và User profile vào Zustand store
      setAuth(authData.accessToken, authData.user);

      // ĐIỀU HƯỚNG THEO ROLE (CẬP NHẬT LOGIC MỚI TẠI ĐÂY)
      const isAdmin = authData.user.roles.includes("ROLE_ADMIN");
      const isTeacher = authData.user.roles.includes("ROLE_TEACHER");

      if (isAdmin) {
        navigate("/admin/users", { replace: true });
      } else if (isTeacher) {
        navigate("/teacher/classrooms", { replace: true });
      } else {
        navigate("/student/courses", { replace: true });
      }
    } catch (err: any) {
      const serverMessage =
        err.response?.data?.message || "Email hoặc mật khẩu không chính xác.";
      setErrors({ general: serverMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="elp-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-8 shadow-sm transition-colors duration-200">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
            <BookOpen size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Đăng Nhập</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Hệ thống Học & Đánh giá năng lực Tiếng Anh
          </p>
        </div>

        {/* Thông báo lỗi từ Server */}
        {errors.general && (
          <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3.5 text-xs font-medium text-rose-700 dark:text-rose-300">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errors.general}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Địa chỉ Email
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail size={16} />
              </span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading}
                placeholder="vd: admin@englishlearning.com"
                className={`w-full rounded-lg border bg-white dark:bg-[#1e293b] py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:text-white outline-none transition focus:ring-2 ${
                  errors.email
                    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
                    : "border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:ring-indigo-100 dark:focus:ring-indigo-500/20"
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs text-rose-500">{errors.email}</p>
            )}
          </div>

          {/* Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mật khẩu
              </label>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock size={16} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                placeholder="Nhập mật khẩu"
                className={`w-full rounded-lg border bg-white dark:bg-[#1e293b] py-2.5 pl-9 pr-10 text-sm text-slate-900 dark:text-white outline-none transition focus:ring-2 ${
                  errors.password
                    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
                    : "border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:ring-indigo-100 dark:focus:ring-indigo-500/20"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-rose-500">{errors.password}</p>
            )}
          </div>

          {/* Nút Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              "Đăng Nhập"
            )}
          </button>
        </form>

        {/* Thông báo chính sách tài khoản nội bộ */}
        <div className="mt-6 rounded-xl border border-indigo-100 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-950/30 p-3.5 text-center text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <p className="font-bold text-indigo-900 dark:text-indigo-300 mb-1 flex items-center justify-center gap-1.5">
            <span>🔒</span> Thông Báo Cấp Phát Tài Khoản
          </p>
          Hệ thống sử dụng tài khoản nội bộ do Quản trị viên cấp. Nếu chưa có tài khoản, vui lòng liên hệ Ban quản trị để được hỗ trợ.
        </div>
      </div>
    </div>
  );
}
