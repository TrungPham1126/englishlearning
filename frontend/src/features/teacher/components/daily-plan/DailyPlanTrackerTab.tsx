import React from "react";
import { Search, Clock } from "lucide-react";
import type { DailyPlanItem } from "./dailyPlanTypes";

interface DailyPlanTrackerTabProps {
  plans: DailyPlanItem[];
  progressStats: any[];
  searchStudent: string;
  setSearchStudent: (s: string) => void;
}

export const DailyPlanTrackerTab: React.FC<DailyPlanTrackerTabProps> = ({
  plans,
  progressStats,
  searchStudent,
  setSearchStudent,
}) => {
  const filteredStudents = progressStats.filter((s) =>
    s.studentName.toLowerCase().includes(searchStudent.toLowerCase()),
  );

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm tên học viên..."
            value={searchStudent}
            onChange={(e) => setSearchStudent(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
          />
        </div>
        <div className="flex items-center space-x-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-emerald-500 mr-1.5"></div>{" "}
            Hoàn thành (100%)
          </span>
          <span className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-amber-500 mr-1.5"></div>{" "}
            Đang làm dở
          </span>
          <span className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-slate-400 dark:bg-slate-700 mr-1.5"></div>{" "}
            Chưa làm
          </span>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#111827] shadow-sm">
        <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
          <thead className="bg-slate-50 dark:bg-[#162033] text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-5 py-4 sticky left-0 bg-slate-50 dark:bg-[#162033] z-10 w-64 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                Học viên
              </th>
              <th className="px-4 py-4 text-center border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#162033]">
                Tổng tiến độ
              </th>
              {plans.map((p) => (
                <th
                  key={p.id}
                  className="px-4 py-4 text-center border-l border-slate-200 dark:border-slate-800 min-w-[100px]"
                >
                  Day {p.dayNumber}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredStudents.length === 0 ? (
              <tr>
                <td
                  colSpan={plans.length + 2}
                  className="p-8 text-center text-slate-500"
                >
                  Không có dữ liệu tiến độ.
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, sIdx) => (
                <tr key={sIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                  <td className="px-5 py-3 sticky left-0 bg-white dark:bg-[#111827] z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                      {student.studentName}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-center border-l border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        student.overallRate >= 80
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : student.overallRate >= 50
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {student.overallRate}%
                    </span>
                  </td>

                  {student.days?.map((day: any, dIdx: number) => (
                    <td
                      key={dIdx}
                      className="px-4 py-3 text-center border-l border-slate-100 dark:border-slate-800"
                    >
                      {day.rate === 100 ? (
                        <div className="flex flex-col items-center">
                          <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                            100%
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center mt-0.5">
                            <Clock className="w-3 h-3 mr-1" /> {day.minutes}{" "}
                            phút
                          </span>
                        </div>
                      ) : day.rate > 0 ? (
                        <div className="flex flex-col items-center">
                          <span className="text-amber-600 dark:text-amber-400 font-bold text-sm">
                            {day.rate}%
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center mt-0.5">
                            <Clock className="w-3 h-3 mr-1" /> {day.minutes}{" "}
                            phút
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 font-medium text-xs">
                          -
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
