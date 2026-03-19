"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSurveyContext } from "@/components/survey-context";
import { fetchJsonSafe, isRecord } from "@/lib/client-json";
import { ScoreBadge, getScoreBorderColor } from "@/components/score-badge";
import { getClinicShortName, CLINIC_GROUPS, groupClinicsByEntity, type ClinicGroup } from "@/lib/clinics";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";

interface ClinicData {
  clinic: string;
  count: number;
  hasDirector: boolean;
  overallAvg: number;
  areaAverages: Array<{ area: string; label: string; score: number }>;
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

function isHeatmapData(value: unknown): value is HeatmapData {
  return isRecord(value) && Array.isArray(value.clinics) && Array.isArray(value.rows);
}

type ViewMode = "all" | "group" | string; // string = specific group id

export default function ClinicsPage() {
  const { id: surveyId } = useSurveyContext();
  const [clinics, setClinics] = useState<ClinicData[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("group");

  useEffect(() => {
    if (!surveyId) return;
    fetchJsonSafe(`/api/surveys/${surveyId}/clinics`, Array.isArray, [] as ClinicData[]).then(setClinics);
    fetchJsonSafe(`/api/surveys/${surveyId}/heatmap`, isHeatmapData, null).then(setHeatmap);
  }, [surveyId]);

  if (!surveyId) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <p className="text-[#6B7280] text-sm">サーベイを選択してください</p>
      </div>
    );
  }

  const grouped = groupClinicsByEntity(clinics);

  // Calculate group averages
  for (const g of grouped) {
    const scores = g.items.map((c) => c.overallAvg).filter((s) => s > 0);
    g.groupAvg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }

  // Filtered clinics based on view mode
  const filteredClinics = viewMode === "all"
    ? clinics
    : viewMode === "group"
      ? clinics
      : clinics.filter((c) => {
          const group = CLINIC_GROUPS.find((g) => g.id === viewMode);
          return group?.clinics.includes(c.clinic);
        });

  // Filtered heatmap clinics
  const filteredHeatmapClinics = heatmap
    ? viewMode === "all" || viewMode === "group"
      ? heatmap.clinics
      : heatmap.clinics.filter((c) => {
          const group = CLINIC_GROUPS.find((g) => g.id === viewMode);
          return group?.clinics.includes(c);
        })
    : [];

  const getScoreLeftBorder = (score: number) => {
    if (score >= 3.5) return "#10B981";
    if (score >= 3.0) return "#F59E0B";
    return "#EF4444";
  };

  const getHeatmapCellBg = (val: number | null) => {
    if (val == null) return "#F9FAFB";
    if (val >= 3.5) return "#DCFCE7";
    if (val >= 3.0) return "#FEF9C3";
    return "#FEE2E2";
  };

  const getHeatmapCellColor = (val: number | null) => {
    if (val == null) return "#9CA3AF";
    if (val >= 3.5) return "#166534";
    if (val >= 3.0) return "#854D0E";
    return "#991B1B";
  };

  const getBarColor = (score: number) => {
    if (score >= 3.5) return "#10B981";
    if (score >= 3.0) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#111827]">拠点別ダッシュボード</h2>
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setViewMode("group")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            viewMode === "group"
              ? "bg-[#10B981] text-white shadow-sm"
              : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
          }`}
        >
          グループ別
        </button>
        <button
          onClick={() => setViewMode("all")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            viewMode === "all"
              ? "bg-[#10B981] text-white shadow-sm"
              : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
          }`}
        >
          全拠点一覧
        </button>
        <div className="w-px h-6 bg-[#E5E7EB] mx-1" />
        {CLINIC_GROUPS.map((group) => (
          <button
            key={group.id}
            onClick={() => setViewMode(group.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
              viewMode === group.id
                ? "text-white shadow-sm"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            }`}
            style={viewMode === group.id ? { backgroundColor: group.color } : {}}
          >
            <span>{group.icon}</span>
            {group.label}
          </button>
        ))}
      </div>

      {/* ========== GROUP VIEW ========== */}
      {viewMode === "group" && (
        <>
          {/* Group Summary Cards */}
          <div className="grid grid-cols-3 gap-5 mb-8">
            {grouped.map((g) => (
              <button
                key={g.group.id}
                onClick={() => setViewMode(g.group.id)}
                className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm text-left hover:shadow-md hover:border-opacity-50 transition-all group"
                style={{ borderLeftWidth: 4, borderLeftColor: g.group.color }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{g.group.icon}</span>
                    <h3 className="text-sm font-semibold text-[#111827]">{g.group.label}</h3>
                  </div>
                  <svg className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#6B7280] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <div className="flex items-end gap-4">
                  <div>
                    <div className="text-[10px] text-[#9CA3AF] mb-1">グループ平均</div>
                    <div className="font-[family-name:var(--font-inter)] text-2xl font-bold" style={{ color: getScoreLeftBorder(g.groupAvg || 0) }}>
                      {g.groupAvg?.toFixed(2) || "-"}
                    </div>
                  </div>
                  <div className="text-xs text-[#9CA3AF]">
                    {g.items.length}拠点 / {g.items.reduce((s, c) => s + c.count, 0)}名
                  </div>
                </div>
                {/* Mini bar for each clinic */}
                <div className="mt-4 space-y-1.5">
                  {g.items.map((c) => (
                    <div key={c.clinic} className="flex items-center gap-2">
                      <span className="text-[10px] text-[#6B7280] w-20 truncate">{getClinicShortName(c.clinic)}</span>
                      <div className="flex-1 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${(c.overallAvg / 5) * 100}%`, backgroundColor: g.group.color }}
                        />
                      </div>
                      <span className="text-[10px] font-[family-name:var(--font-inter)] font-semibold text-[#374151] w-8 text-right">
                        {c.overallAvg.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Group Comparison Chart */}
          {grouped.length > 1 && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-8">
              <h3 className="text-sm font-semibold text-[#111827] mb-4">事業体別スコア比較</h3>
              <ResponsiveContainer width="100%" height={Math.max(200, clinics.length * 36)}>
                <BarChart
                  data={clinics.map((c) => ({
                    name: getClinicShortName(c.clinic),
                    score: c.overallAvg,
                    clinic: c.clinic,
                  })).sort((a, b) => b.score - a.score)}
                  layout="vertical"
                  margin={{ left: 100, right: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#374151" }} width={100} />
                  <Tooltip
                    formatter={(value) => [typeof value === "number" ? value.toFixed(2) : value, "スコア"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }}
                  />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={20}>
                    {clinics.map((c, i) => {
                      const group = CLINIC_GROUPS.find((g) => g.clinics.includes(c.clinic));
                      return <Cell key={i} fill={group?.color || "#6B7280"} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex items-center gap-4 justify-center mt-3">
                {CLINIC_GROUPS.map((g) => (
                  <span key={g.id} className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                    {g.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ========== SPECIFIC GROUP or ALL VIEW ========== */}
      {viewMode !== "group" && (
        <>
          {/* Group Header (when filtering) */}
          {viewMode !== "all" && (() => {
            const activeGroup = CLINIC_GROUPS.find((g) => g.id === viewMode);
            if (!activeGroup) return null;
            const groupClinics = filteredClinics;
            const groupAvg = groupClinics.length > 0
              ? groupClinics.reduce((s, c) => s + c.overallAvg, 0) / groupClinics.length
              : 0;
            const totalCount = groupClinics.reduce((s, c) => s + c.count, 0);
            return (
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm mb-6" style={{ borderLeftWidth: 4, borderLeftColor: activeGroup.color }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{activeGroup.icon}</span>
                    <div>
                      <h3 className="text-base font-bold text-[#111827]">{activeGroup.label}</h3>
                      <p className="text-xs text-[#9CA3AF]">{groupClinics.length}拠点 / 回答者 {totalCount}名</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[#9CA3AF]">グループ平均</div>
                    <div className="font-[family-name:var(--font-inter)] text-3xl font-bold" style={{ color: activeGroup.color }}>
                      {groupAvg.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Clinic Cards */}
          <div className="grid grid-cols-3 gap-5 mb-8">
            {filteredClinics.map((c) => {
              const groupColor = CLINIC_GROUPS.find((g) => g.clinics.includes(c.clinic))?.color || "#6B7280";
              return (
                <Link
                  key={c.clinic}
                  href={`/dashboard/clinics/${encodeURIComponent(c.clinic)}?surveyId=${surveyId}`}
                  className="block group"
                >
                  <div
                    className="bg-white rounded-xl shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md overflow-hidden border border-[#E5E7EB]"
                    style={{ borderLeftWidth: 4, borderLeftColor: getScoreLeftBorder(c.overallAvg) }}
                  >
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-md font-medium text-white"
                          style={{ backgroundColor: groupColor }}
                        >
                          {CLINIC_GROUPS.find((g) => g.clinics.includes(c.clinic))?.label.slice(0, 3) || "他"}
                        </span>
                        <h3 className="text-sm font-semibold text-[#111827] truncate">{getClinicShortName(c.clinic)}</h3>
                      </div>

                      <div className="flex items-start gap-4">
                        <div>
                          <div className="text-[10px] text-[#9CA3AF] mb-1">全体平均</div>
                          <ScoreBadge score={c.overallAvg} size="lg" />
                        </div>

                        <div className="flex-1 h-24">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={c.areaAverages}>
                              <PolarGrid stroke="#E5E7EB" />
                              <PolarAngleAxis dataKey="label" tick={false} />
                              <Radar
                                dataKey="score"
                                stroke={groupColor}
                                fill={groupColor}
                                fillOpacity={0.15}
                                strokeWidth={1.5}
                              />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-[10px] text-[#9CA3AF] mt-2">
                        <span>回答: {c.count}名</span>
                        <span>院長回答: {c.hasDirector ? "あり" : "なし"}</span>
                      </div>

                      {c.alertItems.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#F3F4F6]">
                          <div className="text-[10px] text-[#9CA3AF] mb-1">注意項目</div>
                          <div className="flex flex-wrap gap-1">
                            {c.alertItems.map((a) => (
                              <span key={a.qNum} className="text-[10px] bg-[#FEF2F2] text-[#DC2626] px-1.5 py-0.5 rounded">
                                Q{a.qNum}: {a.score.toFixed(2)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Heatmap */}
          {heatmap && filteredHeatmapClinics.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-[#111827] mb-4">
                {viewMode === "all" ? "全拠点" : CLINIC_GROUPS.find((g) => g.id === viewMode)?.label || ""} ヒートマップ
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="text-left p-2 w-8 text-[#9CA3AF]"></th>
                      <th className="text-left p-2 w-16 text-[#9CA3AF]"></th>
                      {filteredHeatmapClinics.map((clinic) => (
                        <th
                          key={clinic}
                          className="p-1 text-center font-medium text-[#6B7280]"
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
                              className="p-1 text-[10px] text-[#9CA3AF] font-medium align-top border-t border-[#E5E7EB]"
                              rowSpan={heatmap.rows.filter((r) => r.area === row.area).length}
                              style={{ writingMode: "vertical-rl" }}
                            >
                              {row.areaLabel}
                            </td>
                          )}
                          <td className={`p-1 text-[#374151] whitespace-nowrap ${isNewArea ? "border-t border-[#E5E7EB]" : ""}`}>
                            Q{row.num} {row.shortLabel}
                          </td>
                          {filteredHeatmapClinics.map((clinic) => {
                            const val = row.values[clinic];
                            return (
                              <td
                                key={clinic}
                                className={`p-1 text-center font-[family-name:var(--font-inter)] font-semibold ${isNewArea ? "border-t border-[#E5E7EB]" : ""}`}
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
                    <tr className="border-t-2 border-[#111827]">
                      <td className="p-1 text-[10px] font-bold text-[#111827]"></td>
                      <td className="p-1 text-[10px] font-bold text-[#111827]">全体平均</td>
                      {filteredHeatmapClinics.map((clinic) => {
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
                            <div className="text-[8px] font-normal text-[#9CA3AF]">{total?.count}名</div>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
