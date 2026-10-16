// src/features/student/components/ShadowingEvaluationView.tsx
import React, { useState } from "react";
import type { ShadowingEvaluationResponse } from "@/features/student/types";
import { Zap, CheckCircle2, XCircle, Sparkles, Layers } from "lucide-react";

interface Props {
  data: ShadowingEvaluationResponse;
}

export default function ShadowingEvaluationView({ data }: Props) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  const getScoreColor = (score: number, isMissing: boolean = false) => {
    if (isMissing) {
      return "text-slate-600 bg-slate-100 border-slate-300";
    }
    if (score >= 80)
      return "text-emerald-700 bg-emerald-100 border-emerald-300";
    if (score >= 60) return "text-amber-700 bg-amber-100 border-amber-300";
    return "text-rose-700 bg-rose-100 border-rose-300";
  };

  const getTokenStyle = (
    color: "GREEN" | "YELLOW" | "RED" | "GRAY",
    isSelected: boolean,
  ) => {
    const base =
      "px-4 py-2 rounded-xl text-lg lg:text-xl font-black border-2 transition cursor-pointer inline-flex items-center gap-1.5 shadow-sm ";
    const selectedRing = isSelected
      ? "ring-4 ring-indigo-400 ring-offset-2 scale-105 "
      : "";

    switch (color) {
      case "GREEN":
        return (
          base +
          selectedRing +
          "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
        );
      case "YELLOW":
        return (
          base +
          selectedRing +
          "bg-amber-50 text-amber-800 border-amber-400 hover:bg-amber-100"
        );
      case "RED":
        return (
          base +
          selectedRing +
          "bg-rose-50 text-rose-700 border-rose-400 hover:bg-rose-100"
        );
      case "GRAY":
        return (
          base +
          selectedRing +
          "bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200 opacity-80"
        );
      default:
        return (
          base + selectedRing + "bg-slate-50 text-slate-700 border-slate-200"
        );
    }
  };

  return (
    <div className="space-y-8 mt-4 border-t-2 border-dashed border-emerald-200 pt-6">
      {/* 1. Header Đánh Giá & Huy Hiệu Groq Superfast */}
      <div
        className={`rounded-2xl border-2 p-6 md:p-8 shadow-sm transition-all ${
          data.isPassed
            ? "border-emerald-300 bg-emerald-50/80"
            : "border-amber-300 bg-amber-50/80"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 rounded-md bg-indigo-600 text-white px-3 py-1 text-xs font-black tracking-widest uppercase shadow-sm">
                <Zap className="fill-current text-amber-300" size={14} />{" "}
                {data.evaluatedBy === "PYTHON_ACOUSTIC_ENGINE"
                  ? "Acoustic AI Engine (Praat F1/F2)"
                  : "Groq AI Engine <2s"}
              </span>
              <span
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-black border-2 shadow-sm ${
                  data.isPassed
                    ? "bg-emerald-100 text-emerald-800 border-emerald-400"
                    : "bg-rose-100 text-rose-800 border-rose-400"
                }`}
              >
                {data.isPassed ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <XCircle size={18} />
                )}
                {data.isPassed ? " ĐẠT CHUẨN" : "CẦN LUYỆN THÊM"}
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-slate-900">
              {data.statusMessage}
            </h3>
            <p className="text-base text-slate-600 font-medium">
              Ngưỡng đạt:{" "}
              <strong className="text-slate-800">{data.passScore} pts</strong>
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right bg-white p-4 rounded-xl border border-slate-200 shadow-sm min-w-[140px]">
              <span className="text-sm font-black text-slate-400 uppercase tracking-widest block mb-1">
                TỔNG ĐIỂM
              </span>
              <span
                className={`text-5xl lg:text-6xl font-black ${data.isPassed ? "text-emerald-600" : "text-amber-600"}`}
              >
                {data.overallScore}
              </span>
              <span className="text-xl font-bold text-slate-400"> /100</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Hiển Thị Câu (Interactive Tokens Display) PHÓNG TO */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b-2 border-slate-100 pb-4 gap-4">
          <span className="text-base lg:text-lg font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Sparkles className="text-indigo-600" size={20} /> Bản Đồ Phát Âm
            Từng Từ
          </span>
          <div className="flex items-center gap-4 text-sm font-bold bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="h-3.5 w-3.5 rounded-full bg-emerald-500 shadow-sm" />{" "}
              Chuẩn
            </span>
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="h-3.5 w-3.5 rounded-full bg-amber-500 shadow-sm" />{" "}
              Khá
            </span>
            <span className="flex items-center gap-1.5 text-rose-700">
              <span className="h-3.5 w-3.5 rounded-full bg-rose-500 shadow-sm" />{" "}
              Sai
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="h-3.5 w-3.5 rounded-full bg-slate-400 shadow-sm" />{" "}
              Chưa đọc
            </span>
          </div>
        </div>

        {/* Hàng Tokens hiển thị bự */}
        <div className="p-6 md:p-8 rounded-2xl bg-slate-50/80 border-2 border-slate-100 flex flex-wrap items-center gap-y-5 gap-x-3 leading-loose">
          {(data.sentenceTokens || []).map((token, idx) => {
            const cleanWord = token.word.replace(/[.,?!]/g, "").toLowerCase();
            const isSelected = selectedWord === cleanWord;
            return (
              <React.Fragment key={idx}>
                <button
                  type="button"
                  onClick={() => setSelectedWord(isSelected ? null : cleanWord)}
                  className={getTokenStyle(token.color, isSelected)}
                  title={`Bấm xem chi tiết từ "${token.word}"`}
                >
                  <span>{token.word}</span>
                </button>

                {/* Ký hiệu nối âm (Linking) */}
                {token.hasLinkingAfter && (
                  <span
                    className="text-indigo-600 font-black text-xl px-1 select-none flex items-center"
                    title="Nối âm (Liaison)"
                  >
                    ‿
                  </span>
                )}
                {/* Ký hiệu dừng ngắt nhịp (Pause) */}
                {token.hasPauseAfter && (
                  <span
                    className="text-slate-400 font-black text-xl px-2 py-1 rounded-lg bg-white border-2 border-slate-200 shadow-sm select-none"
                    title="Dừng/Ngắt nhịp (Pause)"
                  >
                    ||
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 3. 5 Thước Đo Chuyên Lực (KPI Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          {
            label: "Phát âm (Pronunciation)",
            value: data.kpi?.pronunciation ?? Math.round(data.overallScore),
            unit: "/100",
          },
          {
            label: "Trôi chảy (Fluency)",
            value: data.kpi?.fluency ?? Math.round(data.overallScore),
            unit: "/100",
          },
          {
            label: "Hoàn thiện (Completeness)",
            value: data.kpi?.completeness ?? 100,
            unit: "%",
          },
          {
            label: "Ngữ điệu (Prosody)",
            value: data.kpi?.prosody ?? Math.round(data.overallScore),
            unit: "/100",
          },
          {
            label: "Tốc độ nói (WPM)",
            value: data.kpi?.wordsPerMinute ?? 120,
            unit: "WPM",
          },
        ].map((item, index) => (
          <div
            key={index}
            className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm text-center space-y-2"
          >
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block truncate">
              {item.label}
            </span>
            <p className="text-3xl font-black text-slate-800">
              {item.value}{" "}
              <span className="text-sm font-bold text-slate-400">
                {item.unit}
              </span>
            </p>
            {/* Thanh tiến độ */}
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  item.value >= 80
                    ? "bg-emerald-500"
                    : item.value >= 60
                      ? "bg-amber-500"
                      : "bg-rose-500"
                }`}
                style={{
                  width: `${Math.min(100, (item.value / (item.unit === "WPM" ? 160 : 100)) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* 4. Bảng Chi Tiết (Word & Phonemes Breakdown) PHÓNG TO */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
          <span className="text-base lg:text-lg font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Layers className="text-indigo-600" size={20} /> Phân Tích Phiên Âm
            (IPA) Chi Tiết
          </span>
          {selectedWord && (
            <button
              type="button"
              onClick={() => setSelectedWord(null)}
              className="text-sm bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-bold hover:bg-indigo-100 transition cursor-pointer"
            >
              Xem tất cả
            </button>
          )}
        </div>
        <div className="divide-y-2 divide-slate-100 max-h-[500px] overflow-y-auto pr-2">
          {(data.wordRows || [])
            .filter(
              (row) => !selectedWord || row.word.toLowerCase() === selectedWord,
            )
            .map((row, idx) => {
              const isMissing = row.wordStatus === "MISSING" || row.score === 0;
              return (
                <div
                  key={idx}
                  className="py-4 lg:py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition px-2 rounded-xl"
                >
                  <div className="w-48 flex items-center gap-3">
                    <span
                      className={`font-black text-xl lg:text-2xl ${
                        isMissing ? "text-slate-400 line-through" : "text-slate-900"
                      }`}
                    >
                      {row.word}
                    </span>
                    <span
                      className={`text-sm font-black px-3 py-1 rounded-lg border-2 shadow-sm ${getScoreColor(
                        row.score,
                        isMissing,
                      )}`}
                    >
                      {isMissing ? "Chưa đọc" : `${row.score} pts`}
                    </span>
                  </div>
                  {/* Các âm (Phonemes) được phóng to, sử dụng font Mono */}
                  <div className="flex-1 flex flex-wrap items-center gap-3">
                    {(row.phonemes || []).map((ph, pIdx) => {
                      const phMissing = isMissing || ph.score === 0 || ph.note === "Bạn chưa đọc từ này.";
                      return (
                        <div
                          key={pIdx}
                          className={`px-4 py-2 rounded-xl border-2 flex items-center gap-2 shadow-sm ${getScoreColor(
                            ph.score,
                            phMissing,
                          )}`}
                        >
                          <span className="font-mono font-black text-xl lg:text-2xl tracking-wider">
                            {ph.ipa}
                          </span>
                          {!phMissing && (
                            <span className="text-sm font-bold opacity-80 bg-white/50 px-2 py-0.5 rounded">
                              ({ph.score})
                            </span>
                          )}
                          {ph.note && (
                            <span className="text-sm font-bold ml-2 pl-2 border-l-2 border-current/30">
                              {ph.note}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
