import React from "react";
import {
  RefreshCw,
  BookOpen,
  Headphones,
  Mic,
  Award,
  ShieldCheck,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-3 tabular-nums">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Năng lực
          </h3>
          <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
            Tổng: {totalSkillScore.toFixed(1)}đ
          </span>
          {strongestSkill && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <strongestSkill.icon size={13} className={strongestSkill.color} />
              <span>
                Mạnh nhất: {strongestSkill.name} ({strongestSkill.value.toFixed(1)}đ)
              </span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onRefreshSkills}
          disabled={isRefreshingSkills}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw
            size={13}
            className={isRefreshingSkills ? "animate-spin text-blue-700" : ""}
          />
          <span>{isRefreshingSkills ? "Đang cập nhật..." : "Cập nhật"}</span>
        </button>
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

        {/* Progress Bars for Skills */}
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
                  </span>
                  <span className="text-slate-900 dark:text-white font-extrabold tabular-nums">
                    {s.value.toFixed(1)}đ
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

      {/* Gợi ý & nút lộ trình */}
      {(profile?.aiRecommendedPath || firstCourse?.classId) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4">
          {profile?.aiRecommendedPath ? (
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {profile.aiRecommendedPath}
            </p>
          ) : (
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Tiếp tục luyện tập hàng ngày
            </span>
          )}
          {firstCourse?.classId && (
            <button
              type="button"
              onClick={() =>
                navigate(`/student/courses/${firstCourse.classId}/daily-plan`)
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-800 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <span>Lộ trình</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SkillCompetencyCard;
