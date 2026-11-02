import React from "react";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Headphones,
  Mic,
  Award,
  ShieldCheck,
  Compass,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { StudentSkillProfile } from "@/features/student/types";

interface SkillCompetencyCardProps {
  profile: StudentSkillProfile | null;
  firstCourse?: any;
  isRefreshingSkills: boolean;
  onRefreshSkills: () => void;
}

export const SkillCompetencyCard: React.FC<SkillCompetencyCardProps> = ({
  profile,
  firstCourse,
  isRefreshingSkills,
  onRefreshSkills,
}) => {
  const navigate = useNavigate();

  const skillsList = [
    {
      label: "Listening",
      name: "Nghe",
      value: profile?.listeningScore || 0,
      icon: Headphones,
      color: "text-blue-700 dark:text-blue-400",
      barColor: "bg-blue-800",
    },
    {
      label: "Reading",
      name: "Đọc",
      value: profile?.readingScore || 0,
      icon: BookOpen,
      color: "text-emerald-500",
      barColor: "bg-emerald-500",
    },
    {
      label: "Writing",
      name: "Viết",
      value: profile?.writingScore || 0,
      icon: Award,
      color: "text-blue-600",
      barColor: "bg-blue-600",
    },
    {
      label: "Grammar",
      name: "Ngữ pháp",
      value: profile?.grammarScore || 0,
      icon: ShieldCheck,
      color: "text-amber-500",
      barColor: "bg-amber-500",
    },
    {
      label: "Vocabulary",
      name: "Từ vựng",
      value: profile?.vocabularyScore || 0,
      icon: BookOpen,
      color: "text-rose-500",
      barColor: "bg-rose-500",
    },
    {
      label: "Pronunciation",
      name: "Phát âm",
      value: profile?.pronunciationScore || 0,
      icon: Mic,
      color: "text-indigo-500",
      barColor: "bg-indigo-500",
    },
    {
      label: "Fluency",
      name: "Lưu loát",
      value: profile?.fluencyScore || 0,
      icon: Award,
      color: "text-teal-500",
      barColor: "bg-teal-500",
    },
  ];

  const totalSkillScore = skillsList.reduce((acc, s) => acc + s.value, 0);
  const maxSkillScore = Math.max(...skillsList.map((s) => s.value), 0);
  const sortedSkills = [...skillsList].sort((a, b) => b.value - a.value);
  const strongestSkill = sortedSkills[0];
  const weakestSkills = sortedSkills.filter((s) => s.value <= 3.0);
  const isImbalanced = strongestSkill.value >= 10.0 && weakestSkills.length >= 2;

  // Radar SVG Math
  const chartSize = 280;
  const center = chartSize / 2;
  const radius = 95;
  const totalAxes = skillsList.length;

  const maxAxisVal = Math.max(50, Math.ceil(maxSkillScore / 10) * 10);
  const radarCoords = skillsList.map((skill, index) => {
    const angle = ((Math.PI * 2) / totalAxes) * index - Math.PI / 2;
    const ratio = skill.value > 0 ? Math.min(skill.value / maxAxisVal, 1.0) : 0;
    const r = Math.max(skill.value > 0 ? 8 : 2, ratio * radius);
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      axisX: center + radius * Math.cos(angle),
      axisY: center + radius * Math.sin(angle),
      labelX: center + (radius + 20) * Math.cos(angle),
      labelY: center + (radius + 18) * Math.sin(angle),
      label: skill.name,
      value: skill.value,
    };
  });

  const radarPoints = radarCoords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header Tab Năng Lực & Nút Làm Mới */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Biểu Đồ Năng Lực 6 Kỹ Năng
            </h3>
            <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-slate-900/60 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
              Chuẩn CEFR
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Điểm tích lũy từ kết quả các bài tập
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefreshSkills}
            disabled={isRefreshingSkills}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              size={13}
              className={isRefreshingSkills ? "animate-spin text-blue-700" : ""}
            />
            <span>
              {isRefreshingSkills ? "Đang đồng bộ..." : "Đồng bộ lại"}
            </span>
          </button>
        </div>
      </div>

      {/* 3 Thẻ Tóm Tắt Năng Lực */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Tổng điểm tích lũy
          </span>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-blue-700 dark:text-blue-400">
              {totalSkillScore.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-bold">pts</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Kỹ năng dẫn đầu
          </span>
          <div className="mt-1.5 flex items-center gap-1.5">
            {strongestSkill && (
              <>
                <strongestSkill.icon
                  size={16}
                  className={strongestSkill.color}
                />
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {strongestSkill.name}
                </span>
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                  ({strongestSkill.value.toFixed(1)} pts)
                </span>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Độ cân bằng năng lực
          </span>
          <div className="mt-1.5 flex items-center gap-1.5">
            {isImbalanced ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                <AlertTriangle size={14} /> Lệch kỹ năng đáng kể
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} /> Phát triển hài hòa
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Radar Chart & Skill Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* SVG Radar */}
        <div className="flex justify-center py-2">
          <svg
            width={chartSize}
            height={chartSize}
            className="overflow-visible"
          >
            {/* Concentric Polygons */}
            {[0.25, 0.5, 0.75, 1.0].map((scale, i) => (
              <polygon
                key={i}
                points={skillsList
                  .map((_, index) => {
                    const angle = ((Math.PI * 2) / totalAxes) * index - Math.PI / 2;
                    const r = radius * scale;
                    return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
                strokeWidth="1"
                strokeDasharray={scale < 1 ? "2 2" : undefined}
              />
            ))}

            {/* Radial Axes & Axis Labels */}
            {radarCoords.map((coord, index) => (
              <g key={index}>
                <line
                  x1={center}
                  y1={center}
                  x2={coord.axisX}
                  y2={coord.axisY}
                  stroke="currentColor"
                  className="text-slate-300 dark:text-slate-700"
                  strokeWidth="1"
                />
                <text
                  x={coord.labelX}
                  y={coord.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[10px] font-bold fill-slate-600 dark:fill-slate-300 uppercase tracking-wider"
                >
                  {coord.label}
                </text>
              </g>
            ))}

            {/* Filled Radar Area */}
            <polygon
              points={radarPoints}
              fill="rgba(99, 102, 241, 0.28)"
              stroke="#6366f1"
              strokeWidth="2.5"
              className="transition-all duration-500 ease-out"
            />

            {/* Data Points */}
            {radarCoords.map((coord, index) => (
              <circle
                key={index}
                cx={coord.x}
                cy={coord.y}
                r={coord.value > 0 ? 4.5 : 3}
                className="fill-blue-600 dark:fill-blue-400 stroke-white dark:stroke-[#111827] stroke-2"
              />
            ))}
          </svg>
        </div>

        {/* Progress Bars for 6 Skills */}
        <div className="space-y-3.5">
          {skillsList.map((s) => {
            const IconComp = s.icon;
            const pct = Math.min((s.value / maxAxisVal) * 100, 100);
            return (
              <div key={s.label}>
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <IconComp size={14} className={s.color} />
                    <span>{s.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({s.label})
                    </span>
                  </span>
                  <span className="text-slate-900 dark:text-white font-extrabold">
                    {s.value.toFixed(1)}{" "}
                    <span className="text-[10px] text-slate-400 font-normal">
                      pts
                    </span>
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${s.barColor} transition-all duration-500 rounded-full`}
                    style={{
                      width: `${Math.max(pct, s.value > 0 ? 5 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lộ Trình Ôn Tập Đề Xuất */}
      <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/40 bg-white dark:bg-[#111827] p-5 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xs text-blue-950 dark:text-blue-200">
            <Compass size={18} className="text-blue-700 dark:text-blue-400" />
            <span className="text-sm font-extrabold">
              Lộ Trình Ôn Tập Đề Xuất
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
            <Compass size={11} /> Gợi ý ôn tập
          </span>
        </div>

        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {profile?.aiRecommendedPath &&
          !profile.aiRecommendedPath.includes("Đọc và Từ vựng")
            ? profile.aiRecommendedPath
            : isImbalanced
            ? `Bạn đang có thế mạnh vượt trội ở kỹ năng ${
                strongestSkill.name
              } (${strongestSkill.value.toFixed(
                1,
              )} pts). Tuy nhiên, các kỹ năng nền tảng như Từ vựng (${skillsList
                .find((s) => s.label === "Vocabulary")
                ?.value.toFixed(1)} pts), Nghe (${skillsList
                .find((s) => s.label === "Listening")
                ?.value.toFixed(1)} pts) và Ngữ pháp (${skillsList
                .find((s) => s.label === "Grammar")
                ?.value.toFixed(
                  1,
                )} pts) đang ở mức sơ khai, tạo ra sự chênh lệch lớn trong biểu đồ năng lực. Hãy tăng cường luyện tập các kỹ năng này để phát triển cân bằng hơn.`
            : `Hồ sơ năng lực của bạn đang phát triển tốt ở kỹ năng ${
                strongestSkill.name
              } (${strongestSkill.value.toFixed(
                1,
              )} pts). Hãy tiếp tục hoàn thành các bài tập hàng ngày để kéo đều các kỹ năng còn lại lên mức tương đương.`}
        </p>

        {/* 3 Hành Động Đề Xuất Khắc Phục */}
        <div className="pt-2 border-t border-blue-100 dark:border-blue-900/40 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1">
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
              Ưu tiên 1 • Cấp bách
            </span>
            <p className="font-bold text-slate-900 dark:text-white text-xs">
              Luyện 20-30 Từ vựng / Ngày
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Tăng tốc vốn từ vựng Spaced Repetition để bổ trợ ngữ âm &amp; đọc hiểu.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Ưu tiên 2 • Bổ trợ
            </span>
            <p className="font-bold text-slate-900 dark:text-white text-xs">
              Luyện Nghe &amp; Shadowing
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Tạo đòn bẩy phản xạ nghe để củng cố kỹ năng Nói đang vượt trội.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1">
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">
              Ưu tiên 3 • Bứt phá
            </span>
            <p className="font-bold text-slate-900 dark:text-white text-xs">
              Ngữ pháp &amp; Viết câu B1+
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Củng cố cấu trúc câu hoàn chỉnh để nâng dài điểm tổng thể.
            </p>
          </div>
        </div>

        {firstCourse?.classId && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() =>
                navigate(`/student/courses/${firstCourse.classId}/daily-plan`)
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-800 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
            >
              <span>Đến Lộ Trình Luyện Tập Hàng Ngày</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillCompetencyCard;
