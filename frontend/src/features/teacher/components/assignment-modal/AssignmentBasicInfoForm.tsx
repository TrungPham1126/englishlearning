import React from "react";
import {
  Calendar,
  Clock,
  Users,
  Sliders,
  Percent,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";

interface AssignmentBasicInfoFormProps {
  title: string;
  setTitle: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  setDifficulty: (val: "EASY" | "MEDIUM" | "HARD") => void;
  selectedPlanId: string;
  setSelectedPlanId: (val: string) => void;
  dailyPlans: any[];
  scheduledDate: string;
  setScheduledDate: (val: string) => void;
  dueDate: string;
  setDueDate: (val: string) => void;
  estimatedMinutes: number;
  setEstimatedMinutes: (val: number) => void;
  timeLimitMinutes: number;
  setTimeLimitMinutes: (val: number) => void;
  maxAllowedErrorPercent: number;
  setMaxAllowedErrorPercent: (val: number) => void;
  maxAttempts: number;
  setMaxAttempts: (val: number) => void;
  targetStudents: "ALL" | "WEAK_STUDENTS";
  setTargetStudents: (val: "ALL" | "WEAK_STUDENTS") => void;
  status: "DRAFT" | "PUBLISHED";
  setStatus: (val: "DRAFT" | "PUBLISHED") => void;
}

export const AssignmentBasicInfoForm: React.FC<AssignmentBasicInfoFormProps> = ({
  title,
  setTitle,
  description,
  setDescription,
  difficulty,
  setDifficulty,
  selectedPlanId,
  setSelectedPlanId,
  dailyPlans,
  scheduledDate,
  setScheduledDate,
  dueDate,
  setDueDate,
  estimatedMinutes,
  setEstimatedMinutes,
  timeLimitMinutes,
  setTimeLimitMinutes,
  maxAllowedErrorPercent,
  setMaxAllowedErrorPercent,
  maxAttempts,
  setMaxAttempts,
  targetStudents,
  setTargetStudents,
  status,
  setStatus,
}) => {
  return (
    <div className="space-y-4">
      {/* 1. Tiêu đề & Độ khó */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Tiêu Đề Bài Tập:
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nhập tiêu đề bài tập..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Mức Độ Khó:
          </label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as any)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
          >
            <option value="EASY">Dễ (Easy)</option>
            <option value="MEDIUM">Trung bình (Medium)</option>
            <option value="HARD">Khó (Hard)</option>
          </select>
        </div>
      </div>

      {/* 2. Mô tả / Hướng dẫn */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
          Mô Tả / Hướng Dẫn Học Sinh:
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Nhập hướng dẫn làm bài cho học viên..."
          className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
        />
      </div>

      {/* 3. CẤU HÌNH THỜI GIAN LÀM BÀI & PHẠM VI ĐƯỢC SAI VỚI TẤT CẢ CÁC DẠNG BÀI */}
      <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-slate-900/40 space-y-4">
        <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/50 pb-2">
          <span className="text-xs font-black text-indigo-950 dark:text-indigo-300 uppercase tracking-wide flex items-center gap-1.5">
            <Sliders className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Cấu Hình Khảo Thí &amp; Tiêu Chuẩn Đạt Chuẩn
          </span>
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
            Áp dụng cho mọi dạng bài
          </span>
        </div>

        {/* 3A. THỜI GIAN LÀM BÀI (TIME LIMIT) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Thời Gian Làm Bài (Time Limit):</span>
            </label>
            <span className="text-xs font-mono font-black text-blue-700 dark:text-blue-300">
              {timeLimitMinutes > 0 ? `${timeLimitMinutes} phút` : "Không giới hạn (Làm tự do)"}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[15, 30, 45, 60, 90, 0].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setTimeLimitMinutes(mins);
                  if (mins > 0) setEstimatedMinutes(mins);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer border ${
                  timeLimitMinutes === mins
                    ? "bg-blue-700 text-white border-blue-700 shadow-2xs"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                }`}
              >
                {mins === 0 ? "Không giới hạn" : `${mins} phút`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Tùy chỉnh số phút:</span>
            <input
              type="number"
              min={0}
              max={300}
              value={timeLimitMinutes || ""}
              onChange={(e) => {
                const val = Math.max(0, Number(e.target.value));
                setTimeLimitMinutes(val);
                if (val > 0) setEstimatedMinutes(val);
              }}
              placeholder="0 = không giới hạn..."
              className="w-28 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
            />
            <span className="text-[11px] text-slate-400">phút (Học sinh sẽ có đồng hồ đếm ngược khi làm bài)</span>
          </div>
        </div>

        {/* 3B. PHẠM VI ĐƯỢC SAI VỚI TẤT CẢ CÁC DẠNG BÀI */}
        <div className="space-y-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/50">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              <span>Phạm Vi Được Sai Cho Phép (Max Error Margin):</span>
            </label>
            <span className="text-xs font-mono font-black text-amber-600 dark:text-amber-400">
              Sai tối đa ≤ {maxAllowedErrorPercent}% (Cần đạt ≥ {100 - maxAllowedErrorPercent}%)
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { pct: 0, label: "0% (Tuyệt đối 10/10)" },
              { pct: 10, label: "10% (Rất cao ≥ 9.0)" },
              { pct: 20, label: "20% (Chuẩn đạt ≥ 8.0)" },
              { pct: 30, label: "30% (Khá ≥ 7.0)" },
              { pct: 40, label: "40% (Trung bình ≥ 6.0)" },
              { pct: 50, label: "50% (Cơ bản ≥ 5.0)" },
            ].map((preset) => (
              <button
                key={preset.pct}
                type="button"
                onClick={() => setMaxAllowedErrorPercent(preset.pct)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer border ${
                  maxAllowedErrorPercent === preset.pct
                    ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Tùy chỉnh tỷ lệ sai:</span>
            <input
              type="number"
              min={0}
              max={100}
              value={maxAllowedErrorPercent}
              onChange={(e) => setMaxAllowedErrorPercent(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="w-20 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
            />
            <span className="text-[11px] text-slate-400">%</span>
          </div>

          {/* Hộp giải thích tiêu chuẩn đạt tự động */}
          <div className="rounded-lg bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-2.5 text-xs text-slate-700 dark:text-slate-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 text-[11px]">
              <CheckCircle2 size={13} />
              <span>Quy tắc đạt chuẩn (PASS Criteria):</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              Học sinh được phép sai tối đa <strong className="text-amber-600 dark:text-amber-400">{maxAllowedErrorPercent}%</strong>.
              Để đạt chuẩn (PASS), học sinh phải đạt tối thiểu{" "}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {100 - maxAllowedErrorPercent}% ({((100 - maxAllowedErrorPercent) / 10).toFixed(1)}/10 điểm)
              </strong>.
              Nếu tỷ lệ sai vượt quá {maxAllowedErrorPercent}%, bài làm sẽ tính là chưa đạt và học sinh cần làm lại.
            </p>
          </div>
        </div>

        {/* 3C. SỐ LẦN LÀM BÀI CHO PHÉP (MAX ATTEMPTS) */}
        <div className="space-y-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/50">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Số Lần Làm Bài Tối Đa (Max Attempts):</span>
            </label>
            <span className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-300">
              {maxAttempts > 0 ? `${maxAttempts} lần` : "Không giới hạn"}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 5, 0].map((att) => (
              <button
                key={att}
                type="button"
                onClick={() => setMaxAttempts(att)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer border ${
                  maxAttempts === att
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                }`}
              >
                {att === 0 ? "Không giới hạn" : `${att} lần`}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Nếu học sinh làm hết số lần này mà điểm số vẫn chưa đạt (tỷ lệ sai &gt; {maxAllowedErrorPercent}%), hệ thống sẽ khóa bài và chốt kết quả là <strong className="text-rose-600 font-bold">NOT PASS</strong>.
          </p>
        </div>
      </div>

      {/* 4. Lộ Trình Ngày Học (Daily Study Plan) & Deadline */}
      <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-600/30 bg-blue-50/50 dark:bg-slate-900/20 space-y-3">
        <div>
          <label className="block text-xs font-bold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-blue-700 dark:text-blue-400" /> Gán vào Ngày Học (Daily Study Plan trong Lộ Trình Lớp):
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select
              value={selectedPlanId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedPlanId(val);
                if (val !== "NEW_DAY") {
                  const plan = dailyPlans.find((p: any) => p.id === val);
                  if (plan) setScheduledDate(plan.scheduledDate);
                }
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
            >
              {dailyPlans.map((p: any) => (
                <option key={p.id} value={p.id}>
                  Day {p.dayNumber} ({p.scheduledDate}): {p.title || "Lộ trình ngày"}
                </option>
              ))}
              <option value="NEW_DAY">+ Tạo ngày học mới (Thêm Day tiếp theo)</option>
            </select>

            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" /> Hạn Nộp (Deadline):
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              Thời Lượng Dự Kiến (Phút):
            </label>
            <input
              type="number"
              min={5}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* 5. Đối tượng & Trạng thái */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" /> Giao Cho Đối Tượng:
          </label>
          <select
            value={targetStudents}
            onChange={(e) => setTargetStudents(e.target.value as any)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
          >
            <option value="ALL">Tất cả học sinh trong lớp</option>
            <option value="WEAK_STUDENTS">Chỉ học sinh cần cải thiện (Cảnh báo AI)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Trạng Thái Bài Tập:
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
          >
            <option value="PUBLISHED">Công khai &amp; Mở bài đúng hạn (PUBLISHED)</option>
            <option value="DRAFT">Lưu nháp (DRAFT)</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default AssignmentBasicInfoForm;
