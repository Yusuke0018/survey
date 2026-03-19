"use client";

import { useEffect, useState } from "react";
import { useSurveyContext } from "@/components/survey-context";
import { fetchJsonSafe } from "@/lib/client-json";
import { ScoreBadge } from "@/components/score-badge";
import { getEntityShortName, getEntityGroupColor } from "@/lib/entities";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Comparison {
  staffNum: number;
  shortLabel: string;
  area: string;
  staffScore: number | null;
  managerScore: number | null;
  managerNum: number | null;
  gap: number | null;
}

interface EntityTricompare {
  entity: string;
  staffAvg: number | null;
  managerAvg: number | null;
  corporateAvg: number | null;
  comparisons: Comparison[];
}

export default function TricomparePage() {
  const { id: surveyId } = useSurveyContext();
  const [data, setData] = useState<EntityTricompare[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  useEffect(() => {
    if (!surveyId) return;
    fetchJsonSafe(`/api/surveys/${surveyId}/jg-tricompare`, Array.isArray, [] as EntityTricompare[])
      .then((d: EntityTricompare[]) => {
        setData(d);
        if (d.length > 0 && !selectedEntity) setSelectedEntity(d[0].entity);
      });
  }, [surveyId, selectedEntity]);

  if (!surveyId) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        </div>
        <p className="text-[#6B7280] text-sm">サーベイを選択してください</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full" />
        <span className="ml-3 text-sm text-[#6B7280]">読み込み中...</span>
      </div>
    );
  }

  const getGapColor = (gap: number | null) => {
    if (gap == null) return "#9CA3AF";
    const absGap = Math.abs(gap);
    if (absGap >= 1.0) return "#DC2626";
    if (absGap >= 0.5) return "#F59E0B";
    return "#10B981";
  };

  const getGapBg = (gap: number | null) => {
    if (gap == null) return "transparent";
    const absGap = Math.abs(gap);
    if (absGap >= 1.0) return "#FEF2F2";
    if (absGap >= 0.5) return "#FFFBEB";
    return "#F0FDF4";
  };

  const selected = data.find((d) => d.entity === selectedEntity);

  // Overview chart data
  const overviewData = data.map((d) => ({
    name: getEntityShortName(d.entity),
    entity: d.entity,
    staff: d.staffAvg,
    manager: d.managerAvg,
    corporate: d.corporateAvg,
  }));

  return (
    <div>
      <h2 className="text-xl font-bold text-[#111827] mb-6">3者比較分析</h2>

      {/* Overview Chart */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-8">
        <h3 className="text-sm font-semibold text-[#111827] mb-4">事業体別 3者平均スコア</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={overviewData} margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#374151" }} />
            <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
            <Tooltip
              formatter={(value, name) => [
                typeof value === "number" ? value.toFixed(2) : "-",
                name === "staff" ? "スタッフ" : name === "manager" ? "責任者" : "経営企画室",
              ]}
              contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }}
            />
            <Legend
              formatter={(value) =>
                value === "staff" ? "スタッフ" : value === "manager" ? "責任者" : "経営企画室"
              }
            />
            <Bar dataKey="staff" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={16} />
            <Bar dataKey="manager" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={16} />
            <Bar dataKey="corporate" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Entity Selector + Detail */}
      <div className="grid grid-cols-4 gap-6">
        {/* Entity List */}
        <div className="col-span-1 space-y-2">
          <div className="text-xs font-semibold text-[#9CA3AF] mb-3">事業体を選択</div>
          {data.map((d) => (
            <button
              key={d.entity}
              onClick={() => setSelectedEntity(d.entity)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all border ${
                selectedEntity === d.entity
                  ? "bg-[#ECFDF5] border-[#10B981] text-[#059669] font-medium"
                  : "bg-white border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{getEntityShortName(d.entity)}</span>
                <div className="flex items-center gap-1">
                  {d.staffAvg != null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#3B82F6]">
                      S:{d.staffAvg.toFixed(1)}
                    </span>
                  )}
                  {d.managerAvg != null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#F59E0B]">
                      M:{d.managerAvg.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detail Table */}
        <div className="col-span-3">
          {selected && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#111827]">
                  {selected.entity} - スタッフ vs 責任者 ギャップ
                </h3>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#3B82F6]" />スタッフ: {selected.staffAvg?.toFixed(2) || "-"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#F59E0B]" />責任者: {selected.managerAvg?.toFixed(2) || "-"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#8B5CF6]" />経営企画室: {selected.corporateAvg?.toFixed(2) || "-"}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E7EB]">
                      <th className="text-left p-2 text-[#9CA3AF]">Q</th>
                      <th className="text-left p-2 text-[#9CA3AF]">項目</th>
                      <th className="text-left p-2 text-[#9CA3AF]">領域</th>
                      <th className="text-center p-2 text-[#3B82F6]">スタッフ</th>
                      <th className="text-center p-2 text-[#F59E0B]">責任者</th>
                      <th className="text-center p-2 text-[#6B7280]">ギャップ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.comparisons.map((c) => (
                      <tr key={c.staffNum} className="border-b border-[#F3F4F6]">
                        <td className="p-2 text-[#9CA3AF]">Q{c.staffNum}</td>
                        <td className="p-2 text-[#374151]">{c.shortLabel}</td>
                        <td className="p-2 text-[#9CA3AF]">{c.area}</td>
                        <td className="p-2 text-center">
                          <ScoreBadge score={c.staffScore} size="sm" />
                        </td>
                        <td className="p-2 text-center">
                          {c.managerScore != null ? (
                            <ScoreBadge score={c.managerScore} size="sm" />
                          ) : (
                            <span className="text-[#9CA3AF]">-</span>
                          )}
                        </td>
                        <td
                          className="p-2 text-center font-[family-name:var(--font-inter)] font-semibold"
                          style={{ backgroundColor: getGapBg(c.gap), color: getGapColor(c.gap) }}
                        >
                          {c.gap != null ? (c.gap > 0 ? "+" : "") + c.gap.toFixed(2) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Gap Legend */}
              <div className="flex items-center gap-4 mt-4 text-[10px] text-[#6B7280]">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1.5 rounded bg-[#10B981]" />|差| &lt; 0.5: 一致
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1.5 rounded bg-[#F59E0B]" />|差| 0.5〜1.0: 要注意
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-1.5 rounded bg-[#DC2626]" />|差| &ge; 1.0: 要対応
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
