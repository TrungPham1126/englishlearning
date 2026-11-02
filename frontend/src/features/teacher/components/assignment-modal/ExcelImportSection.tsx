import React from "react";
import {
  FileSpreadsheet,
  Download,
  Layers,
  HelpCircle,
  UploadCloud,
} from "lucide-react";

interface ExcelImportSectionProps {
  assignmentType: string;
  handleDownloadSkillExcelTemplate: () => void;
  handleDownloadFullExcelTemplate: () => void;
  setShowCheatSheetModal: (val: boolean) => void;
  handleImportExcelFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ExcelImportSection: React.FC<ExcelImportSectionProps> = ({
  assignmentType,
  handleDownloadSkillExcelTemplate,
  handleDownloadFullExcelTemplate,
  setShowCheatSheetModal,
  handleImportExcelFile,
}) => {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5 p-5 space-y-4 animate-in fade-in">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 border-b border-emerald-500/20 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <span>Nhập Đề Thi Nhanh Từ File Excel (.xlsx, .xls, .csv)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                Multi-Sheet Scanner
              </span>
            </h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              Tự động nhận diện đa sheet, kế thừa bài đọc/kịch bản nghe và ánh xạ thông minh đáp án A, B, C, D
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadSkillExcelTemplate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-xs shrink-0"
            title={`Tải file mẫu Excel chuẩn dành riêng cho kỹ năng ${assignmentType}`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Tải Mẫu Kỹ Năng ({assignmentType})</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadFullExcelTemplate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-bold transition cursor-pointer shadow-2xs shrink-0"
            title="Tải file mẫu Excel đầy đủ 7 Sheets bao quát toàn bộ 6 kỹ năng và các dạng bài tập"
          >
            <Layers className="h-3.5 w-3.5 text-emerald-500" />
            <span>Tải Mẫu Chuẩn Tổng Hợp (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCheatSheetModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-slate-900/50 border border-blue-400/40 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/60 text-xs font-bold transition cursor-pointer shadow-2xs shrink-0"
            title="Xem bảng hướng dẫn chi tiết quy chuẩn các cột và ví dụ cụ thể cho từng dạng bài"
          >
            <HelpCircle className="h-3.5 w-3.5 text-blue-600" />
            <span>Xem Hướng Dẫn &amp; Ví Dụ</span>
          </button>
        </div>
      </div>

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleImportExcelFile({
              target: { files: e.dataTransfer.files },
            } as any);
          }
        }}
        className="border-2 border-dashed border-emerald-400/60 dark:border-emerald-500/40 hover:border-emerald-500 rounded-xl p-7 flex flex-col items-center justify-center gap-3 cursor-pointer bg-white/80 dark:bg-slate-950/60 hover:bg-emerald-500/10 transition group text-center shadow-2xs"
      >
        <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
          <UploadCloud className="h-6 w-6" />
        </div>
        <div>
          <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 block">
            Kéo &amp; Thả File Excel vào đây hoặc bấm để chọn từ máy tính
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Hỗ trợ định dạng <span className="font-mono font-semibold">.xlsx, .xls, .csv</span> • Tự động phân tích câu hỏi &amp; chuyển sang Bước 2
          </p>
        </div>
        <input
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleImportExcelFile}
          className="hidden"
        />
      </label>

      <div className="rounded-xl bg-white/90 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3.5 space-y-2 text-[11px] text-slate-700 dark:text-slate-300">
        <span className="font-extrabold text-emerald-700 dark:text-emerald-400 block">
          Quy chuẩn các cột tự động nhận diện trong bảng Excel:
        </span>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          <div>• <b className="text-slate-800 dark:text-slate-300">STT</b>: Số thứ tự</div>
          <div>• <b className="text-slate-800 dark:text-slate-300">Kỹ năng</b>: VOCABULARY, LISTENING...</div>
          <div>• <b className="text-slate-800 dark:text-slate-300">Dạng câu hỏi</b>: MULTIPLE_CHOICE, FILL_IN_BLANK...</div>
          <div>• <b className="text-slate-800 dark:text-slate-300">Đề bài</b>: Nội dung câu hỏi</div>
          <div>• <b className="text-slate-800 dark:text-slate-300">Lựa chọn A, B, C, D</b>: Các phương án</div>
          <div>• <b className="text-slate-800 dark:text-slate-300">Đáp án đúng</b>: Đáp án chính xác</div>
          <div>• <b className="text-slate-800 dark:text-slate-300">Giải thích</b>: Lời giải chi tiết</div>
          <div>• <b className="text-slate-800 dark:text-slate-300">Kịch bản nghe</b>: Toàn bộ đoạn nghe dài</div>
          <div>• <b className="text-slate-800 dark:text-slate-300">Từ vựng / IPA</b>: Dành cho Vocabulary</div>
        </div>
      </div>
    </div>
  );
};

export default ExcelImportSection;
