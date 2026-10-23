// src/features/auth/pages/RegisterPage.tsx
import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldAlert, ArrowRight, Lock } from "lucide-react";

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
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
          <ShieldAlert size={28} />
        </div>

        <h1 className="text-xl font-black text-slate-800">
          Chức Năng Tự Đăng Ký Đã Đóng
        </h1>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed text-left">
          <p className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
            <Lock size={14} className="text-indigo-600" /> Chính sách tài khoản nội bộ
          </p>
          Hệ thống sử dụng tài khoản nội bộ do Quản trị viên cấp. Nếu chưa có tài khoản, vui lòng liên hệ Ban quản trị để được hỗ trợ.
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Đang tự động chuyển hướng về trang đăng nhập...
        </p>

        <div className="mt-6">
          <Link
            to="/login"
            replace
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Đến Trang Đăng Nhập
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
