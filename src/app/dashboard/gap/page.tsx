"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ScoreBadge } from "@/components/score-badge";
import { AreaBadge } from "@/components/area-badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { AreaKey } from "@/lib/questions";

interface GapData {
  clinic: string;
  staffAvg: number;
  directorAvg: number;
  gapAvg: number;
  maxGap: { num: number; gap: number | null; shortLabel: string };
  questionGaps: Array<{
    id: string; num: number; shortLabel: string;
    area: AreaKey; areaLabel: string;
    staffScore: number | null; directorScore: number | null; gap: number | null;
  }>;
}

export default function GapPage() {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get("surveyId");
  const [gaps, setGaps] = useState<GapData[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!surveyId) return;
    fetch(`/api/surveys/${surveyId}/gap`).then((r) => r.json()).then(setGaps);
  }, [surveyId]);

  if (!surveyId) {
    return <div className="text-center py-20 text-[#64748B]">サーベイを選択してください</div>;
  }

  const getGapColor = (gap: number) => {
    if (gap >= 1.5) return "#FCA5A5";
    if (gap >= 0.5) return "#FDE68A";
    if (gap >= -0.5) return "#BBF7D0";
    return "#BFDBFE";
  };

  const getGapBorder = (gap: number) => {
    if (gap >= 1.5) return "#EF4444";
    if (gap >= 0.5) return "#EAB308";
    if (gap >= -0.5) return "#22C55E";
    return "#3B82F6";
  };

  const selectedGap = gaps.find((g) => g.clinic === selected);

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#1E293B] mb-6">ギャップ分析</h2>

      {gaps.length === 0 ? (
        <div className="text-center py-20 text-[#64748B]">院長回答のある拠点がありません</div>
      ) : (
        <>
          {/* Gap Overview Cards */}
          <div className="space-y-4 mb-10">
            {gaps.map((g) => (
              <div
                key={g.clinic}
                className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                style={{ borderLeft: `4px solid ${getGapBorder(g.gapAvg)}` }}
                onClick={() => setSelected(g.clinic === selected ? null : g.clinic)}
              >
                {g.gapAvg >= 1.0 && (
                  <div className="bg-[#FEF9C3] px-5 py-1.5 text-[10px] text-[#854D0E] font-medium">
                    ⚠️ 認識ギャップ大
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[#1E293B]">{g.clinic}</h3>
                    <span className="text-xs text-[#64748B]">{selected === g.clinic ? "▲ 閉じる" : "▼ 詳細"}</span>
                  </div>

                  <div className="flex items-center gap-8 mb-3">
                    <div>
                      <div className="text-[10px] text-[#64748B]">院長平均</div>
                      <div className="font-[family-name:var(--font-inter)] font-bold text-lg">{g.directorAvg.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#64748B]">スタッフ平均</div>
                      <div className="font-[family-name:var(--font-inter)] font-bold text-lg">{g.staffAvg.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#64748B]">ギャップ</div>
                      <div
                        className="font-[family-name:var(--font-inter)] font-bold text-lg px-2 py-0.5 rounded"
                        style={{ backgroundColor: getGapColor(g.gapAvg) }}
                      >
                        {g.gapAvg > 0 ? "+" : ""}{g.gapAvg.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#8B5CF6] rounded-full" style={{ width: `${(g.directorAvg / 5) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-[#64748B]">院長</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: `${(g.staffAvg / 5) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-[#64748B]">スタッフ</span>
                  </div>

                  <div className="mt-3 text-xs text-[#64748B]">
                    最大ギャップ: Q{g.maxGap.num}（{g.maxGap.gap != null && g.maxGap.gap > 0 ? "+" : ""}{g.maxGap.gap?.toFixed(2)}）
                    「{g.maxGap.shortLabel}」
                  </div>
                </div>

                {/* Expanded Detail */}
                {selected === g.clinic && (
                  <div className="border-t border-[#E2E8F0] p-5 animate-fade-in">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={g.questionGaps.map((q) => ({
                          name: `Q${q.num}`,
                          院長: q.directorScore,
                          スタッフ: q.staffScore,
                        }))}
                        layout="vertical"
                        margin={{ left: 40 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={40} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="院長" fill="#8B5CF6" barSize={10} radius={[0, 3, 3, 0]} />
                        <Bar dataKey="スタッフ" fill="#3B82F6" barSize={10} radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
