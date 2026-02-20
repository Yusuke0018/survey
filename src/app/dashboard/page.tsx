"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ScoreBadge } from "@/components/score-badge";
import { ScoreBar } from "@/components/score-bar";
import { AreaBadge } from "@/components/area-badge";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import type { AreaKey } from "@/lib/questions";

interface Summary {
  staffCount: number;
  directorCount: number;
  overallAvg: number;
  highest: { num: number; score: number; area: string };
  lowest: { num: number; score: number; area: string };
}

interface ScoreData {
  scores: Array<{
    id: string; num: number; text: string; shortLabel: string;
    area: AreaKey; areaLabel: string; areaColor: string; score: number | null;
  }>;
  areaAverages: Array<{
    area: AreaKey; label: string; color: string; score: number;
  }>;
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get("surveyId");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);

  useEffect(() => {
    if (!surveyId) return;
    fetch(`/api/surveys/${surveyId}/summary`).then((r) => r.json()).then(setSummary);
    fetch(`/api/surveys/${surveyId}/scores`).then((r) => r.json()).then(setScoreData);
  }, [surveyId]);

  if (!surveyId) {
    return <div className="text-center py-20 text-[#64748B]">サーベイを選択してください</div>;
  }

  if (!summary || !scoreData) {
    return <div className="text-center py-20 text-[#64748B]">読み込み中...</div>;
  }

  // Group scores by area
  const grouped: Record<string, typeof scoreData.scores> = {};
  for (const s of scoreData.scores) {
    if (!grouped[s.area]) grouped[s.area] = [];
    grouped[s.area].push(s);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#1E293B] mb-6">全体ダッシュボード</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
          <div className="text-xs text-[#64748B] mb-2">回答数</div>
          <div className="font-[family-name:var(--font-inter)] text-4xl font-bold text-[#1E293B]">
            {summary.staffCount + summary.directorCount}
            <span className="text-base font-normal text-[#64748B] ml-1">名</span>
          </div>
          <div className="text-xs text-[#64748B] mt-1">スタッフ{summary.staffCount} / 院長{summary.directorCount}</div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
          <div className="text-xs text-[#64748B] mb-2">全体平均</div>
          <div className="mt-1">
            <ScoreBadge score={summary.overallAvg} size="lg" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
          <div className="text-xs text-[#64748B] mb-2">最高スコア</div>
          <div className="font-[family-name:var(--font-inter)] text-4xl font-bold text-[#166534]">
            {summary.highest.score.toFixed(2)}
          </div>
          <div className="text-xs text-[#64748B] mt-1">Q{summary.highest.num}: {summary.highest.area}</div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
          <div className="text-xs text-[#64748B] mb-2">最低スコア</div>
          <div className="font-[family-name:var(--font-inter)] text-4xl font-bold text-[#991B1B]">
            {summary.lowest.score.toFixed(2)}
          </div>
          <div className="text-xs text-[#64748B] mt-1">Q{summary.lowest.num}: {summary.lowest.area}</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
          <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">領域別レーダーチャート</h3>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={scoreData.areaAverages}>
              <PolarGrid stroke="#E2E8F0" />
              <PolarAngleAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "#64748B" }}
              />
              <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} />
              <Radar
                dataKey="score"
                stroke="#2563EB"
                fill="#2563EB"
                fillOpacity={0.2}
                strokeWidth={2}
                animationDuration={800}
              />
              <Tooltip
                formatter={(value) => [typeof value === "number" ? value.toFixed(2) : value, "スコア"]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Question List */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm overflow-y-auto max-h-[440px]">
          <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">質問別スコア</h3>
          {Object.entries(grouped).map(([area, questions]) => (
            <div key={area} className="mb-4">
              <div className="mb-2">
                <AreaBadge area={area as AreaKey} />
              </div>
              {questions.map((q) => (
                <div
                  key={q.id}
                  className={`flex items-center gap-3 py-1.5 px-2 rounded ${
                    q.score != null && q.score < 3.0 ? "bg-[#FEE2E2]/30" : ""
                  }`}
                >
                  <span className="text-xs text-[#64748B] w-8 flex-shrink-0">Q{q.num}</span>
                  <span className="text-xs text-[#1E293B] flex-1 truncate" title={q.text}>
                    {q.shortLabel}
                  </span>
                  <div className="w-32 flex-shrink-0">
                    <ScoreBar score={q.score} showValue={false} />
                  </div>
                  <ScoreBadge score={q.score} size="sm" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
