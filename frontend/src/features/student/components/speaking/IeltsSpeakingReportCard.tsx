import React from "react";
import {
  AlertOctagon,
  Target,
  Check,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Lightbulb,
} from "lucide-react";
import type { FullSpeakingAiResult } from "@/features/student/types";

export interface IeltsSpeakingReportCardProps {
  report: FullSpeakingAiResult;
}

export const IeltsSpeakingReportCard: React.FC<IeltsSpeakingReportCardProps> = ({
  report,
}) => {
  return (
    <div className="space-y-6 pt-4 border-t-2 border-dashed border-blue-200 dark:border-slate-800 animate-in fade-in duration-200">
      <div className="flex items-center gap-2">
        <Target size={18} className="text-blue-700 dark:text-blue-400" />
        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
          Nhận Xét & Đánh Giá Chi Tiết (Tiêu chuẩn IELTS):
        </h4>
      </div>

      {report.isOffTopic && (
        <div className="rounded-xl border-2 border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 p-5 text-rose-900 dark:text-rose-200 shadow-xs flex items-start gap-3">
          <AlertOctagon
            size={28}
            className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5"
          />
          <div className="space-y-1">
            <h4 className="text-sm font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
              Phát hiện lạc đề (Off-Topic)
            </h4>
            <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed font-medium">
              Nội dung bài nói không trả lời trực tiếp hoặc đi chệch hướng so với yêu cầu đề bài. Overall Band bị giới hạn tối đa 4.0.
            </p>
          </div>
        </div>
      )}

      {/* Thống kê Tổng quan (Bands, CEFR, WPM) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div
          className={`rounded-xl border p-3.5 sm:p-4 text-center ${
            report.isOffTopic
              ? "border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20"
              : "border-blue-100 dark:border-blue-600/30 bg-blue-50/40 dark:bg-slate-900/20"
          }`}
        >
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Overall Band
          </span>
          <p
            className={`text-2xl sm:text-3xl font-extrabold mt-0.5 ${
              report.isOffTopic
                ? "text-rose-600 dark:text-rose-400"
                : "text-blue-800 dark:text-blue-400"
            }`}
          >
            {report.overallBand}{" "}
            <span className="text-sm font-semibold text-slate-400">/ 9.0</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 text-center shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Trình độ CEFR
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {report.estimatedCefr}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 text-center shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Tốc độ nói
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white mt-0.5">
            {report.wordsPerMinute}{" "}
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              WPM
            </span>
          </p>
        </div>
      </div>

      {/* Task Achievement */}
      {report.taskAchievement && (
        <div className="rounded-xl border border-blue-100 dark:border-blue-600/30 bg-blue-50/40 dark:bg-slate-900/20 p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-600/20 pb-2">
            <span className="text-xs font-black text-blue-950 dark:text-blue-200 flex items-center gap-1.5 uppercase tracking-wider">
              <Target size={16} className="text-blue-700 dark:text-blue-400" />
              Độ Hoàn Thành Yêu Cầu (Task Response):
            </span>
            {report.taskAchievement.score !== undefined && (
              <span className="text-xs font-black text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-600/30 px-2 py-0.5 rounded">
                {report.taskAchievement.score.toFixed(1)} / 9.0
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-2">
              <span className="font-bold text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                Đã trả lời được:
              </span>
              {report.taskAchievement.addressedPoints &&
              report.taskAchievement.addressedPoints.length > 0 ? (
                <ul className="space-y-1.5">
                  {report.taskAchievement.addressedPoints.map((item, idx) => (
                    <li
                      key={idx}
                      className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200 font-medium rounded-lg p-2 text-xs leading-relaxed"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Chưa ghi nhận.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <span className="font-bold text-xs text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <XCircle size={14} className="text-rose-600 dark:text-rose-400" />
                Cần bổ sung / thiếu ý:
              </span>
              {report.taskAchievement.missingPoints &&
              report.taskAchievement.missingPoints.length > 0 ? (
                <ul className="space-y-1.5">
                  {report.taskAchievement.missingPoints.map((item, idx) => (
                    <li
                      key={idx}
                      className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 text-rose-900 dark:text-rose-200 font-medium rounded-lg p-2 text-xs leading-relaxed"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 rounded-lg p-2">
                  Đã hoàn thành đầy đủ yêu cầu.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4 Tiêu Chí IELTS */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5 shadow-2xs">
        <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
          Điểm 4 Tiêu Chí Khảo Thí (Rubrics)
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-center">
          {[
            {
              label: "Phát âm (Pronunciation)",
              val: report.pronunciationScore,
            },
            {
              label: "Độ trôi chảy (Fluency)",
              val: report.fluencyScore,
            },
            {
              label: "Từ vựng (Lexical)",
              val: report.lexicalScore,
            },
            {
              label: "Ngữ pháp (Grammar)",
              val: report.grammarScore,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg"
            >
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block truncate">
                {item.label}
              </span>
              <span className="text-xl font-bold text-slate-800 dark:text-white mt-0.5 block">
                {item.val}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Sửa Lỗi Chi Tiết (Mistakes) */}
      {report.mistakes && report.mistakes.length > 0 && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-950/20 p-5 space-y-4 shadow-2xs">
          <h4 className="text-sm font-black text-rose-800 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle size={18} /> Sửa Lỗi Chi Tiết (Mistakes)
          </h4>
          <div className="grid gap-3">
            {report.mistakes.map((m, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-100 dark:border-slate-800 shadow-2xs space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 px-3 py-1 rounded-md text-sm font-bold line-through decoration-rose-500">
                    {m.original}
                  </span>
                  <ArrowRight
                    size={16}
                    className="text-slate-400 hidden sm:block"
                  />
                  <span className="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 px-3 py-1 rounded-md text-sm font-black border border-emerald-200 dark:border-emerald-500/30">
                    {m.correction}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 px-1.5 py-0.5 rounded text-[10px] mr-1.5 uppercase">
                    {m.type}
                  </span>
                  {m.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nhận xét chung & Native Phrasing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 p-5 space-y-2 shadow-2xs">
          <h4 className="text-xs font-black text-amber-900 dark:text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Lightbulb size={16} /> Nhận Xét Tổng Quan
          </h4>
          <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
            {report.generalFeedback}
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 dark:border-blue-600/30 bg-blue-50/70 dark:bg-slate-900/20 p-5 space-y-2 shadow-2xs">
          <h4 className="text-xs font-black text-blue-900 dark:text-blue-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Check size={16} /> Cách Diễn Đạt Tự Nhiên Hơn (Native Phrasing)
          </h4>
          <p className="text-xs text-blue-950 dark:text-blue-200 leading-relaxed font-medium italic">
            "{report.correctedText}"
          </p>
        </div>
      </div>

      {/* Kịch bản nhận diện STT */}
      {report.transcript && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-5 space-y-2 shadow-2xs">
          <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            Transcript nhận diện từ giọng nói:
          </span>
          <p className="text-xs text-slate-800 dark:text-slate-200 italic bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 leading-relaxed font-medium">
            "{report.transcript}"
          </p>
        </div>
      )}
    </div>
  );
};

export default IeltsSpeakingReportCard;
