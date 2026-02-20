"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { AREAS, AREA_ORDER, type AreaKey } from "@/lib/questions";

interface Survey {
  id: number;
  name: string;
  conducted_at: string;
}

interface TrendData {
  surveyId: number;
  name: string;
  conductedAt: string;
  areaAverages: Array<{ area: AreaKey; label: string; color: string; score: number }>;
  clinicScores: Array<{ clinic: string; avg: number }>;
}

export default function TrendsPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [view, setView] = useState<"area" | "clinic">("area");

  useEffect(() => {
    fetch("/api/surveys").then((r) => r.json()).then((data: Survey[]) => {
      setSurveys(data);
      if (data.length > 0) {
        setSelectedIds(data.map((s) => s.id));
      }
    });
  }, []);

  useEffect(() => {
    if (selectedIds.length === 0) return;
    fetch(`/api/trends?ids=${selectedIds.join(",")}`).then((r) => r.json()).then(setTrends);
  }, [selectedIds]);

  const toggleSurvey = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Prepare area chart data
  const areaChartData = trends.map((t) => {
    const point: Record<string, string | number> = { name: t.name };
    for (const a of t.areaAverages) {
      point[a.label] = a.score;
    }
    return point;
  });

  // Get unique clinics
  const allClinics = Array.from(new Set(trends.flatMap((t) => t.clinicScores.map((c) => c.clinic))));
  const clinicChartData = trends.map((t) => {
    const point: Record<string, string | number> = { name: t.name };
    for (const c of t.clinicScores) {
      point[c.clinic] = c.avg;
    }
    return point;
  });

  const clinicColors = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899", "#F97316", "#6366F1", "#14B8A6", "#A855F7"];

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#1E293B] mb-6">時系列比較</h2>

      {/* Survey Selection */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm mb-6">
        <h3 className="text-xs font-medium text-[#64748B] mb-3">比較するサーベイを選択</h3>
        <div className="flex flex-wrap gap-2">
          {surveys.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.includes(s.id)}
                onChange={() => toggleSurvey(s.id)}
                className="rounded"
              />
              {s.name}（{s.conducted_at}）
            </label>
          ))}
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          className={`text-sm px-4 py-2 rounded-lg transition-colors ${view === "area" ? "bg-[#2563EB] text-white" : "bg-white text-[#64748B] border border-[#E2E8F0]"}`}
          onClick={() => setView("area")}
        >
          領域別
        </button>
        <button
          className={`text-sm px-4 py-2 rounded-lg transition-colors ${view === "clinic" ? "bg-[#2563EB] text-white" : "bg-white text-[#64748B] border border-[#E2E8F0]"}`}
          onClick={() => setView("clinic")}
        >
          拠点別
        </button>
      </div>

      {trends.length < 2 ? (
        <div className="text-center py-20 text-[#64748B]">2つ以上のサーベイを選択してください</div>
      ) : (
        <>
          {/* Chart */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm mb-8">
            <ResponsiveContainer width="100%" height={400}>
              {view === "area" ? (
                <LineChart data={areaChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {AREA_ORDER.map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={AREAS[key].label}
                      stroke={AREAS[key].color}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      animationDuration={800}
                    />
                  ))}
                </LineChart>
              ) : (
                <LineChart data={clinicChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {allClinics.map((clinic, i) => (
                    <Line
                      key={clinic}
                      type="monotone"
                      dataKey={clinic}
                      stroke={clinicColors[i % clinicColors.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      animationDuration={800}
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Comparison Table */}
          {trends.length >= 2 && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
              <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">前回比較</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0]">
                    <th className="text-left py-2 text-[#64748B]">項目</th>
                    {trends.map((t) => (
                      <th key={t.surveyId} className="text-center py-2 text-[#64748B]">{t.name}</th>
                    ))}
                    <th className="text-center py-2 text-[#64748B]">変化</th>
                  </tr>
                </thead>
                <tbody>
                  {AREA_ORDER.map((key) => {
                    const scores = trends.map((t) => t.areaAverages.find((a) => a.area === key)?.score || 0);
                    const diff = scores.length >= 2 ? scores[scores.length - 1] - scores[scores.length - 2] : 0;
                    return (
                      <tr key={key} className="border-b border-[#E2E8F0]/50">
                        <td className="py-2 text-[#1E293B]">{AREAS[key].label}</td>
                        {scores.map((s, i) => (
                          <td key={i} className="py-2 text-center font-[family-name:var(--font-inter)] font-semibold">{s.toFixed(2)}</td>
                        ))}
                        <td className="py-2 text-center font-[family-name:var(--font-inter)] font-bold">
                          <span className={diff > 0 ? "text-[#166534]" : diff < 0 ? "text-[#991B1B]" : "text-[#64748B]"}>
                            {diff > 0 ? "↑" : diff < 0 ? "↓" : "→"} {Math.abs(diff).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
