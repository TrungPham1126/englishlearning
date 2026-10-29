// src/features/auth/pages/LoginPage.tsx
import React, { useState } from "react";
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
  AlertCircle,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button, Input, Badge } from "@/components/ui";

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

      // Điều hướng theo Role
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
    <div className="w-full max-w-[960px] grid grid-cols-1 lg:grid-cols-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1526] shadow-elevated overflow-hidden transition-all duration-200">
      {/* Cột Trái: Product Showcase Banner */}
      <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-8 bg-slate-900 text-white overflow-hidden border-r border-slate-800">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-blue-800/10 blur-3xl"
        />

        <div className="relative z-10">
          <Badge variant="primary" size="md" className="mb-6">
            <Sparkles size={13} className="mr-1" />
            AI-Powered English Platform
          </Badge>

          <h2 className="text-xl font-extrabold leading-snug tracking-tight text-white">
            Chinh phục Tiếng Anh theo lộ trình cá nhân hóa
          </h2>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            Kết hợp phương pháp lặp lại ngắt quãng (SRS), lộ trình học tập theo ngày
            và công nghệ phân tích ngữ âm AI chuẩn quốc tế.
          </p>
        </div>

        <div className="relative z-10 space-y-3 my-8">
          {[
            "Lộ trình học theo ngày (Daily Study Roadmap)",
            "Chấm phát âm & Shadowing AI thời gian thực",
            "Phân tích kỹ năng 6 trục chuẩn CEFR",
          ].map((feature, index) => (
            <div
              key={index}
              className="flex items-center gap-2.5 text-xs font-medium text-slate-200"
            >
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        <div className="relative z-10 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Bảo mật chuẩn JWT &amp; RBAC</span>
          <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-200 font-mono font-bold text-xs">
            v2.5 Enterprise
          </span>
        </div>
      </div>

      {/* Cột Phải: Form Đăng Nhập */}
      <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center bg-white dark:bg-[#0e1526]">
        {/* Header: Side-by-side icon & title to eliminate icon-tile-stack anti-pattern */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-800 text-white shadow-xs">
            <GraduationCap size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Chào mừng trở lại
            </h1>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Đăng nhập vào hệ thống Học &amp; Đánh giá năng lực Tiếng Anh ELP
            </p>
          </div>
        </div>

        {/* Thông báo lỗi từ Server */}
        {errors.general && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-md border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 animate-in fade-in duration-200"
          >
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span>{errors.general}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email Input */}
          <Input
            label="Địa chỉ Email"
            id="login-email"
            type="email"
            name="email"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            disabled={isLoading}
            error={errors.email}
            placeholder="vd: student@englishlearning.com"
            startIcon={<Mail size={16} />}
          />

          {/* Password Input */}
          <div className="relative">
            <Input
              label="Mật khẩu"
              id="login-password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
              error={errors.password}
              placeholder="Nhập mật khẩu của bạn"
              startIcon={<Lock size={16} />}
              endIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={isLoading}
              rightIcon={<ArrowRight size={16} />}
            >
              Đăng Nhập Hệ Thống
            </Button>
          </div>
        </form>

        {/* Thông báo chính sách tài khoản (Flattened, no nested card container) */}
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-200 mb-0.5 text-xs">
                Chính Sách Cấp Phát Tài Khoản Nội Bộ
              </p>
              <p className="text-xs leading-relaxed">
                Hệ thống sử dụng tài khoản định danh do Quản trị viên cấp. Nếu chưa có
                tài khoản hoặc quên mật khẩu, vui lòng liên hệ Ban quản trị đào tạo để nhận hỗ trợ kịp thời.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
