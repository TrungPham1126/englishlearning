import React, { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";

export const PasswordChangeForm: React.FC = () => {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      alert("Mật khẩu mới phải có ít nhất 8 ký tự!");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Mật khẩu xác nhận không khớp!");
      return;
    }
    alert("Đã cập nhật mật khẩu thành công!");
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="p-6 sm:p-8 space-y-5 max-w-lg">
      <div className="border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Lock size={18} className="text-rose-600 dark:text-rose-400" />
          <span>Đổi Mật Khẩu &amp; Bảo Mật Tài Khoản</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Sử dụng mật khẩu mạnh tối thiểu 8 ký tự để bảo vệ tài khoản học tập
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Mật khẩu hiện tại
          </label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0b1120] px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Mật khẩu mới
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Tối thiểu 8 ký tự..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0b1120] px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Xác nhận mật khẩu mới
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0b1120] px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
            required
          />
        </div>
        <div className="pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition cursor-pointer"
          >
            <ShieldCheck size={15} />
            <span>Cập nhật mật khẩu</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default PasswordChangeForm;
