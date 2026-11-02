import React from "react";
import {
  Info,
  User as UserIcon,
  Phone,
  Mail,
  Award,
  Target,
  CheckCircle2,
  Save,
  Loader2,
} from "lucide-react";

interface ProfileEditFormProps {
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    currentLevel: string;
    targetCefr: string;
  };
  firstCourse?: any;
  isSaving: boolean;
  saveSuccess: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSave: (e: React.FormEvent) => void;
}

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  formData,
  firstCourse,
  isSaving,
  saveSuccess,
  onChange,
  onSave,
}) => {
  return (
    <div className="flex-1 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between px-6 sm:px-8 py-4 bg-slate-50/80 dark:bg-[#162033] border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400">
              <Info size={16} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Thông Tin Hồ Sơ Học Viên
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Cập nhật thông tin liên hệ và mục tiêu đầu ra CEFR của bạn
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={onSave} className="p-6 sm:p-8 space-y-5 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Họ và đệm
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <UserIcon size={15} />
                </span>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={onChange}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0b1120] pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none transition disabled:opacity-60"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tên gọi
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <UserIcon size={15} />
                </span>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={onChange}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0b1120] pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none transition disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Số điện thoại liên hệ
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Phone size={15} />
                </span>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={onChange}
                  disabled={isSaving}
                  placeholder="Nhập số điện thoại..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0b1120] pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none transition disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Địa chỉ Email (Định danh)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail size={15} />
                </span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  disabled
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/70 pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-75"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Trình độ hiện tại (Theo lớp học)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-blue-600">
                  <Award size={15} />
                </span>
                <input
                  type="text"
                  value={
                    firstCourse?.level
                      ? `Cấp độ ${firstCourse.level}`
                      : "Chưa cấu hình theo lớp"
                  }
                  disabled
                  className="w-full rounded-xl border border-blue-200/70 dark:border-blue-600/30 bg-blue-50/50 dark:bg-slate-900/20 pl-10 pr-3.5 py-2.5 text-xs font-bold text-blue-800 dark:text-blue-300 cursor-not-allowed"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Mục tiêu đầu ra (Target CEFR)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-emerald-500">
                  <Target size={15} />
                </span>
                <input
                  type="text"
                  name="targetCefr"
                  value={formData.targetCefr}
                  onChange={onChange}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#0b1120] pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none transition disabled:opacity-60"
                />
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Footer Action Bar */}
      <div className="px-6 sm:px-8 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0d1322]/60 flex items-center justify-between gap-4">
        {saveSuccess ? (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 animate-in fade-in duration-200">
            <CheckCircle2 size={15} /> Đã cập nhật thông tin thành công!
          </span>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Nhấn Lưu thay đổi sau khi chỉnh sửa hồ sơ
          </span>
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
        >
          {isSaving ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Đang lưu...</span>
            </>
          ) : (
            <>
              <Save size={15} />
              <span>Lưu thay đổi</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ProfileEditForm;
