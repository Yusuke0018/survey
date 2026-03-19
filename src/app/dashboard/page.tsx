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
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-[#6B7280] text-sm">右上のプルダウンからサーベイを選択してください</p>
      </div>
    );
  }

  if (!summary || !scoreData) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full" />
        <span className="ml-3 text-sm text-[#6B7280]">読み込み中...</span>
      </div>
    );
  }

  // Group scores by area
  const grouped: Record<string, typeof scoreData.scores> = {};
  for (const s of scoreData.scores) {
    if (!grouped[s.area]) grouped[s.area] = [];
    grouped[s.area].push(s);
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[#111827] mb-6">全体ダッシュボード</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-[#EFF6FF] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-[#3B82F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-xs text-[#6B7280]">回答数</span>
          </div>
          <div className="font-[family-name:var(--font-inter)] text-3xl font-bold text-[#111827]">
            {summary.staffCount + summary.directorCount}
            <span className="text-sm font-normal text-[#6B7280] ml-1">名</span>
          </div>
          <div className="text-xs text-[#9CA3AF] mt-1">スタッフ {summary.staffCount} / 院長 {summary.directorCount}</div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-[#ECFDF5] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <span className="text-xs text-[#6B7280]">全体平均</span>
          </div>
          <div className="mt-1">
            <ScoreBadge score={summary.overallAvg} size="lg" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-[#DCFCE7] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-[#16A34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
            <span className="text-xs text-[#6B7280]">最高スコア</span>
          </div>
          <div className="font-[family-name:var(--font-inter)] text-3xl font-bold text-[#16A34A]">
            {summary.highest.score.toFixed(2)}
          </div>
          <div className="text-xs text-[#9CA3AF] mt-1">Q{summary.highest.num}: {summary.highest.area}</div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-[#FEE2E2] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-[#DC2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <span className="text-xs text-[#6B7280]">最低スコア</span>
          </div>
          <div className="font-[family-name:var(--font-inter)] text-3xl font-bold text-[#DC2626]">
            {summary.lowest.score.toFixed(2)}
          </div>
          <div className="text-xs text-[#9CA3AF] mt-1">Q{summary.lowest.num}: {summary.lowest.area}</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-[#111827] mb-4">領域別レーダーチャート</h3>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={scoreData.areaAverages}>
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "#6B7280" }}
              />
              <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} />
              <Radar
                dataKey="score"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.15}
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
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm overflow-y-auto max-h-[440px]">
          <h3 className="text-sm font-semibold text-[#111827] mb-4">質問別スコア</h3>
          {Object.entries(grouped).map(([area, questions]) => (
            <div key={area} className="mb-4">
              <div className="mb-2">
                <AreaBadge area={area as AreaKey} />
              </div>
              {questions.map((q) => (
                <div
                  key={q.id}
                  className={`flex items-center gap-3 py-1.5 px-2 rounded-lg ${
                    q.score != null && q.score < 3.0 ? "bg-[#FEF2F2]" : ""
                  }`}
                >
                  <span className="text-xs text-[#9CA3AF] w-8 flex-shrink-0">Q{q.num}</span>
                  <span className="text-xs text-[#374151] flex-1 truncate" title={q.text}>
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
