// src/features/auth/pages/RegisterPage.tsx
import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldAlert, ArrowRight, Lock, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Tự động chuyển hướng về trang đăng nhập sau 3 giây
    const timer = setTimeout(() => {
      navigate("/login", { replace: true });
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="w-full max-w-md">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-card p-8 shadow-card text-center transition-colors duration-200">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/30 shadow-sm">
          <ShieldAlert size={28} />
        </div>

        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Chức Năng Tự Đăng Ký Đã Đóng
        </h1>

        <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed text-left">
          <p className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
            <Lock size={14} className="text-blue-700 dark:text-blue-400" />
            <span>Chính sách tài khoản nội bộ</span>
          </p>
          Hệ thống sử dụng tài khoản nội bộ do Quản trị viên cấp. Nếu chưa có tài
          khoản, vui lòng liên hệ Ban quản trị để được hỗ trợ.
        </div>

        <div className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Loader2 size={14} className="animate-spin text-blue-700 dark:text-blue-400" />
          <span>Đang tự động chuyển hướng về trang đăng nhập...</span>
        </div>

        <div className="mt-6">
          <Link
            to="/login"
            replace
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 py-3 px-4 text-sm font-semibold text-white shadow-sm transition"
          >
            <span>Đến Trang Đăng Nhập</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
