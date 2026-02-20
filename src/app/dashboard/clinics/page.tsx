"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ScoreBadge, getScoreBorderColor } from "@/components/score-badge";
import { getClinicShortName } from "@/lib/clinics";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from "recharts";
import type { AreaKey } from "@/lib/questions";

interface ClinicData {
  clinic: string;
  count: number;
  hasDirector: boolean;
  overallAvg: number;
  areaAverages: Array<{ area: AreaKey; label: string; score: number }>;
  alertItems: Array<{ qNum: number; score: number; label: string }>;
}

interface HeatmapData {
  clinics: string[];
  rows: Array<{
    id: string; num: number; shortLabel: string;
    area: string; areaLabel: string; values: Record<string, number | null>;
  }>;
  clinicTotals: Record<string, { avg: number; count: number }>;
}

export default function ClinicsPage() {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get("surveyId");
  const [clinics, setClinics] = useState<ClinicData[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);

  useEffect(() => {
    if (!surveyId) return;
    fetch(`/api/surveys/${surveyId}/clinics`).then((r) => r.json()).then(setClinics);
    fetch(`/api/surveys/${surveyId}/heatmap`).then((r) => r.json()).then(setHeatmap);
  }, [surveyId]);

  if (!surveyId) {
    return <div className="text-center py-20 text-[#64748B]">サーベイを選択してください</div>;
  }

  const getScoreLeftBorder = (score: number) => {
    if (score >= 3.5) return "#22C55E";
    if (score >= 3.0) return "#EAB308";
    return "#EF4444";
  };

  const getHeatmapCellBg = (val: number | null) => {
    if (val == null) return "#F8FAFC";
    if (val >= 3.5) return "#DCFCE7";
    if (val >= 3.0) return "#FEF9C3";
    return "#FEE2E2";
  };

  const getHeatmapCellColor = (val: number | null) => {
    if (val == null) return "#94A3B8";
    if (val >= 3.5) return "#166534";
    if (val >= 3.0) return "#854D0E";
    return "#991B1B";
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#1E293B] mb-6">拠点別ダッシュボード</h2>

      {/* Clinic Cards Grid */}
      <div className="grid grid-cols-3 gap-6 mb-10">
        {clinics.map((c) => (
          <Link
            key={c.clinic}
            href={`/dashboard/clinics/${encodeURIComponent(c.clinic)}?surveyId=${surveyId}`}
            className="block group"
          >
            <div
              className="bg-white rounded-xl shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg overflow-hidden"
              style={{
                borderLeft: `4px solid ${getScoreLeftBorder(c.overallAvg)}`,
                border: c.overallAvg < 3.0
                  ? `1px solid ${getScoreBorderColor(c.overallAvg)}`
                  : "1px solid #E2E8F0",
                borderLeftWidth: "4px",
                borderLeftColor: getScoreLeftBorder(c.overallAvg),
              }}
            >
              <div className="p-5">
                <h3 className="text-sm font-semibold text-[#1E293B] mb-3 truncate">{c.clinic}</h3>

                <div className="flex items-start gap-4">
                  <div>
                    <div className="text-[10px] text-[#64748B] mb-1">全体平均</div>
                    <ScoreBadge score={c.overallAvg} size="lg" />
                  </div>

                  <div className="flex-1 h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={c.areaAverages}>
                        <PolarGrid stroke="#E2E8F0" />
                        <PolarAngleAxis dataKey="label" tick={false} />
                        <Radar
                          dataKey="score"
                          stroke="#2563EB"
                          fill="#2563EB"
                          fillOpacity={0.15}
                          strokeWidth={1.5}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-[#64748B] mt-2">
                  <span>回答: {c.count}名</span>
                  <span>院長回答: {c.hasDirector ? "あり" : "なし"}</span>
                </div>

                {c.alertItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
                    <div className="text-[10px] text-[#64748B] mb-1">注意項目</div>
                    <div className="flex flex-wrap gap-1">
                      {c.alertItems.map((a) => (
                        <span key={a.qNum} className="text-[10px] bg-[#FEE2E2] text-[#991B1B] px-1.5 py-0.5 rounded">
                          Q{a.qNum}: {a.score.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Heatmap */}
      {heatmap && heatmap.clinics.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
          <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">拠点×質問 ヒートマップ</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="text-left p-2 w-8 text-[#64748B]"></th>
                  <th className="text-left p-2 w-16 text-[#64748B]"></th>
                  {heatmap.clinics.map((clinic) => (
                    <th
                      key={clinic}
                      className="p-1 text-center font-medium text-[#64748B]"
                      style={{ writingMode: "vertical-rl", textOrientation: "mixed", height: 80, fontSize: 10 }}
                    >
                      {getClinicShortName(clinic)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.rows.map((row, idx) => {
                  const isNewArea = idx === 0 || heatmap.rows[idx - 1].area !== row.area;
                  return (
                    <tr key={row.id}>
                      {isNewArea && (
                        <td
                          className="p-1 text-[10px] text-[#64748B] font-medium align-top border-t border-[#E2E8F0]"
                          rowSpan={heatmap.rows.filter((r) => r.area === row.area).length}
                          style={{ writingMode: "vertical-rl" }}
                        >
                          {row.areaLabel}
                        </td>
                      )}
                      <td className={`p-1 text-[#1E293B] whitespace-nowrap ${isNewArea ? "border-t border-[#E2E8F0]" : ""}`}>
                        Q{row.num} {row.shortLabel}
                      </td>
                      {heatmap.clinics.map((clinic) => {
                        const val = row.values[clinic];
                        return (
                          <td
                            key={clinic}
                            className={`p-1 text-center font-[family-name:var(--font-inter)] font-semibold ${isNewArea ? "border-t border-[#E2E8F0]" : ""}`}
                            style={{
                              backgroundColor: getHeatmapCellBg(val),
                              color: getHeatmapCellColor(val),
                              fontSize: 11,
                            }}
                          >
                            {val != null ? val.toFixed(1) : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="border-t-2 border-[#1E293B]">
                  <td className="p-1 text-[10px] font-bold text-[#1E293B]"></td>
                  <td className="p-1 text-[10px] font-bold text-[#1E293B]">全体平均</td>
                  {heatmap.clinics.map((clinic) => {
                    const total = heatmap.clinicTotals[clinic];
                    return (
                      <td
                        key={clinic}
                        className="p-1 text-center font-[family-name:var(--font-inter)] font-bold"
                        style={{
                          backgroundColor: getHeatmapCellBg(total?.avg || null),
                          color: getHeatmapCellColor(total?.avg || null),
                          fontSize: 11,
                        }}
                      >
                        {total?.avg.toFixed(1) || "-"}
                        <div className="text-[8px] font-normal text-[#64748B]">{total?.count}名</div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
