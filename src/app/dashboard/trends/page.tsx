"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { fetchJsonSafe } from "@/lib/client-json";

interface Survey {
  id: number;
  name: string;
  conducted_at: string;
}

interface TrendData {
  surveyId: number;
  name: string;
  conductedAt: string;
  areaAverages: Array<{ area: string; label: string; color: string; score: number }>;
  clinicScores: Array<{ clinic: string; avg: number }>;
  questionScores: Array<{ questionKey: string; num: number; shortLabel: string; area: string; areaLabel: string; score: number | null }>;
}

export default function TrendsPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [view, setView] = useState<"area" | "clinic" | "question">("area");

  useEffect(() => {
    fetchJsonSafe("/api/surveys", Array.isArray, [] as Survey[]).then((data: Survey[]) => {
      setSurveys(data);
      if (data.length > 0) {
        setSelectedIds(data.map((s) => s.id));
      }
    });
  }, []);

  useEffect(() => {
    if (selectedIds.length === 0) return;
    fetchJsonSafe(`/api/trends?ids=${selectedIds.join(",")}`, Array.isArray, [] as TrendData[]).then(setTrends);
  }, [selectedIds]);

  const toggleSurvey = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Derive unique areas dynamically from the API response
  const uniqueAreas = trends.length > 0
    ? trends[0].areaAverages.map((a) => ({ area: a.area, label: a.label, color: a.color }))
    : [];

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

  // Collect unique questionKeys across all surveys (matched by questionKey, not position)
  const allQuestionKeys = Array.from(new Set(trends.flatMap((t) => t.questionScores.map((q) => q.questionKey))));

  // Build a lookup: questionKey -> { shortLabel, area, areaLabel, num }
  const questionMeta: Record<string, { shortLabel: string; area: string; areaLabel: string; num: number }> = {};
  for (const t of trends) {
    for (const q of t.questionScores) {
      if (!questionMeta[q.questionKey]) {
        questionMeta[q.questionKey] = { shortLabel: q.shortLabel, area: q.area, areaLabel: q.areaLabel, num: q.num };
      }
    }
  }

  // Prepare question chart data: each point is a survey, keys are shortLabels
  const questionChartData = trends.map((t) => {
    const point: Record<string, string | number | null> = { name: t.name };
    const scoreMap = new Map(t.questionScores.map((q) => [q.questionKey, q.score]));
    for (const qk of allQuestionKeys) {
      const meta = questionMeta[qk];
      if (meta) {
        point[meta.shortLabel] = scoreMap.get(qk) ?? null;
      }
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
        <button
          className={`text-sm px-4 py-2 rounded-lg transition-colors ${view === "question" ? "bg-[#2563EB] text-white" : "bg-white text-[#64748B] border border-[#E2E8F0]"}`}
          onClick={() => setView("question")}
        >
          設問別
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
                  {uniqueAreas.map((a) => (
                    <Line
                      key={a.area}
                      type="monotone"
                      dataKey={a.label}
                      stroke={a.color}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      animationDuration={800}
                    />
                  ))}
                </LineChart>
              ) : view === "clinic" ? (
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
              ) : (
                <LineChart data={questionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {allQuestionKeys.map((qk, i) => {
                    const meta = questionMeta[qk];
                    return (
                      <Line
                        key={qk}
                        type="monotone"
                        dataKey={meta?.shortLabel ?? qk}
                        stroke={clinicColors[i % clinicColors.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        animationDuration={800}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Comparison Table */}
          {view === "area" && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
              <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">前回比較（領域別）</h3>
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
                  {uniqueAreas.map((a) => {
                    const scores = trends.map((t) => t.areaAverages.find((aa) => aa.area === a.area)?.score || 0);
                    const diff = scores.length >= 2 ? scores[scores.length - 1] - scores[scores.length - 2] : 0;
                    return (
                      <tr key={a.area} className="border-b border-[#E2E8F0]/50">
                        <td className="py-2 text-[#1E293B]">{a.label}</td>
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

          {view === "clinic" && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
              <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">前回比較（拠点別）</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0]">
                    <th className="text-left py-2 text-[#64748B]">拠点</th>
                    {trends.map((t) => (
                      <th key={t.surveyId} className="text-center py-2 text-[#64748B]">{t.name}</th>
                    ))}
                    <th className="text-center py-2 text-[#64748B]">変化</th>
                  </tr>
                </thead>
                <tbody>
                  {allClinics.map((clinic) => {
                    const scores = trends.map((t) => t.clinicScores.find((c) => c.clinic === clinic)?.avg || 0);
                    const diff = scores.length >= 2 ? scores[scores.length - 1] - scores[scores.length - 2] : 0;
                    return (
                      <tr key={clinic} className="border-b border-[#E2E8F0]/50">
                        <td className="py-2 text-[#1E293B]">{clinic}</td>
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

          {view === "question" && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
              <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">前回比較（設問別）</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      <th className="text-left py-2 text-[#64748B] whitespace-nowrap">No.</th>
                      <th className="text-left py-2 text-[#64748B] whitespace-nowrap">設問</th>
                      <th className="text-left py-2 text-[#64748B] whitespace-nowrap">領域</th>
                      {trends.map((t) => (
                        <th key={t.surveyId} className="text-center py-2 text-[#64748B] whitespace-nowrap">{t.name}</th>
                      ))}
                      <th className="text-center py-2 text-[#64748B] whitespace-nowrap">変化</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allQuestionKeys.map((qk) => {
                      const meta = questionMeta[qk];
                      const scores = trends.map((t) => {
                        const found = t.questionScores.find((q) => q.questionKey === qk);
                        return found?.score ?? null;
                      });
                      const numericScores = scores.filter((s): s is number => s != null);
                      const diff = numericScores.length >= 2
                        ? numericScores[numericScores.length - 1] - numericScores[numericScores.length - 2]
                        : 0;
                      return (
                        <tr key={qk} className="border-b border-[#E2E8F0]/50">
                          <td className="py-2 text-[#64748B] whitespace-nowrap">Q{meta?.num ?? "-"}</td>
                          <td className="py-2 text-[#1E293B] whitespace-nowrap">{meta?.shortLabel ?? qk}</td>
                          <td className="py-2 text-[#64748B] whitespace-nowrap">{meta?.areaLabel ?? "-"}</td>
                          {scores.map((s, i) => (
                            <td key={i} className="py-2 text-center font-[family-name:var(--font-inter)] font-semibold">
                              {s != null ? s.toFixed(2) : "-"}
                            </td>
                          ))}
                          <td className="py-2 text-center font-[family-name:var(--font-inter)] font-bold">
                            {numericScores.length >= 2 ? (
                              <span className={diff > 0 ? "text-[#166534]" : diff < 0 ? "text-[#991B1B]" : "text-[#64748B]"}>
                                {diff > 0 ? "↑" : diff < 0 ? "↓" : "→"} {Math.abs(diff).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-[#64748B]">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
