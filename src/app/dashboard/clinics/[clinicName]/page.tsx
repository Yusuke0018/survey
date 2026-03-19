"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSurveyContext } from "@/components/survey-context";
import { fetchJsonSafe, isRecord } from "@/lib/client-json";
import { ScoreBadge } from "@/components/score-badge";
import { ScoreBar } from "@/components/score-bar";
import { AreaBadge } from "@/components/area-badge";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, Cell, ReferenceLine,
} from "recharts";
import type { AreaKey } from "@/lib/questions";

interface ClinicDetail {
  clinic: string;
  count: number;
  hasDirector: boolean;
  overallAvg: number;
  highest: { num: number; score: number };
  lowest: { num: number; score: number };
  questionScores: Array<{
    id: string; num: number; text: string; shortLabel: string;
    area: AreaKey; areaLabel: string; areaColor: string;
    clinicScore: number | null; globalScore: number | null; diff: number | null;
    directorScore: number | null;
  }>;
  areaAverages: Array<{
    area: AreaKey; label: string; color: string;
    clinicScore: number; globalScore: number;
  }>;
  responses: Array<{
    id: string; timestamp: string; name: string; avgScore: number; freeText: string | null;
  }>;
  freeTexts: Array<{ text: string; name: string; timestamp: string }>;
  directorResponse: Array<{
    id: string; num: number; shortLabel: string;
    directorScore: number | null; staffScore: number | null;
  }> | null;
}

function isClinicDetail(value: unknown): value is ClinicDetail {
  return isRecord(value)
    && typeof value.clinic === "string"
    && Array.isArray(value.questionScores)
    && Array.isArray(value.areaAverages)
    && Array.isArray(value.responses)
    && Array.isArray(value.freeTexts);
}

function getGapBarColor(gap: number | null) {
  if (gap == null) return "#CBD5E1";
  if (gap >= 1.0) return "#EF4444";
  if (gap >= 0.35) return "#FB7185";
  if (gap <= -1.0) return "#2563EB";
  if (gap <= -0.35) return "#38BDF8";
  return "#94A3B8";
}

function ClinicGapTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    payload: {
      label: string;
      gap: number | null;
      directorScore: number | null;
      staffScore: number | null;
      areaLabel: string;
    };
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0].payload;
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
      <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
      <p className="mt-1 text-xs text-[#475569]">{item.areaLabel}</p>
      <div className="mt-3 space-y-1.5 text-xs text-[#334155]">
        <div className="flex items-center justify-between gap-6">
          <span>院長自己評価</span>
          <span className="font-semibold text-[#DC2626]">{item.directorScore?.toFixed(2) ?? "-"}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span>スタッフ平均</span>
          <span className="font-semibold text-[#2563EB]">{item.staffScore?.toFixed(2) ?? "-"}</span>
        </div>
        <div className="flex items-center justify-between gap-6 border-t border-[#E2E8F0] pt-2">
          <span>ギャップ</span>
          <span className="font-bold" style={{ color: getGapBarColor(item.gap) }}>
            {item.gap != null ? `${item.gap > 0 ? "+" : ""}${item.gap.toFixed(2)}` : "-"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ClinicDetailPage() {
  const params = useParams();
  const { id: surveyId } = useSurveyContext();
  const clinicName = decodeURIComponent(params.clinicName as string);
  const [data, setData] = useState<ClinicDetail | null>(null);

  useEffect(() => {
    if (!surveyId || !clinicName) return;
    fetchJsonSafe(`/api/surveys/${surveyId}/clinics/${encodeURIComponent(clinicName)}`, isClinicDetail, null)
      .then(setData);
  }, [surveyId, clinicName]);

  if (!data) {
    return <div className="text-center py-20 text-[#64748B]">読み込み中...</div>;
  }

  // Group questions by area
  const grouped: Record<string, typeof data.questionScores> = {};
  for (const q of data.questionScores) {
    if (!grouped[q.area]) grouped[q.area] = [];
    grouped[q.area].push(q);
  }

  // Radar chart data
  const radarData = data.areaAverages.map((a) => ({
    label: a.label,
    clinic: a.clinicScore,
    overall: a.globalScore,
  }));

  // Gap chart data
  const gapData = data.questionScores
    .filter((q) => q.directorScore != null && q.clinicScore != null)
    .map((q) => ({
      id: q.id,
      label: `Q${q.num} ${q.shortLabel}`,
      shortLabel: q.shortLabel,
      areaLabel: q.areaLabel,
      gap: q.directorScore != null && q.clinicScore != null ? Math.round((q.directorScore - q.clinicScore) * 100) / 100 : null,
      directorScore: q.directorScore,
      staffScore: q.clinicScore,
    }));

  return (
    <div>
      <Link
        href={`/dashboard/clinics?surveyId=${surveyId}`}
        className="text-sm text-[#2563EB] hover:underline mb-4 inline-block"
      >
        ← 拠点一覧に戻る
      </Link>

      <h2 className="text-2xl font-bold text-[#1E293B] mb-2">{data.clinic}</h2>
      <p className="text-sm text-[#64748B] mb-6">
        回答数: {data.count}名 | 院長回答: {data.hasDirector ? "あり" : "なし"} | 全体平均: {data.overallAvg.toFixed(2)}
      </p>

      {/* Score Summary + Radar */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
          <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">スコアサマリー</h3>
          <div className="flex items-center gap-4 mb-4">
            <div>
              <div className="text-xs text-[#64748B] mb-1">全体平均</div>
              <ScoreBadge score={data.overallAvg} size="lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#DCFCE7]/50 rounded-lg p-3">
              <div className="text-[10px] text-[#64748B]">最高</div>
              <div className="font-[family-name:var(--font-inter)] font-bold text-[#166534]">
                Q{data.highest.num}: {data.highest.score.toFixed(2)}
              </div>
            </div>
            <div className="bg-[#FEE2E2]/50 rounded-lg p-3">
              <div className="text-[10px] text-[#64748B]">最低</div>
              <div className="font-[family-name:var(--font-inter)] font-bold text-[#991B1B]">
                Q{data.lowest.num}: {data.lowest.score.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
          <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">レーダーチャート</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#E2E8F0" />
              <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} />
              <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9 }} />
              <Radar dataKey="clinic" stroke="#2563EB" fill="#2563EB" fillOpacity={0.2} strokeWidth={2} name="この拠点" />
              <Radar dataKey="overall" stroke="#94A3B8" fill="transparent" strokeWidth={1} strokeDasharray="4 4" name="全体平均" />
              <Tooltip formatter={(v) => typeof v === "number" ? v.toFixed(2) : v} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Area Detail Scores */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm mb-8">
        <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">領域別スコア詳細</h3>
        {Object.entries(grouped).map(([area, questions]) => {
          const areaAvg = data.areaAverages.find((a) => a.area === area);
          return (
            <div key={area} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <AreaBadge area={area as AreaKey} />
                <span className="text-xs text-[#64748B]">
                  平均 {areaAvg?.clinicScore.toFixed(2)}
                </span>
              </div>
              <div className="space-y-1">
                {questions.map((q) => (
                  <div
                    key={q.id}
                    className={`flex items-center gap-3 py-2 px-3 rounded ${
                      q.clinicScore != null && q.clinicScore < 3.0 ? "bg-[#FEE2E2]/20" : ""
                    }`}
                  >
                    <span className="text-xs text-[#64748B] w-8">Q{q.num}</span>
                    <span className="text-xs text-[#1E293B] w-24 truncate" title={q.text}>{q.shortLabel}</span>
                    <div className="flex-1">
                      <ScoreBar score={q.clinicScore} globalAvg={q.globalScore} />
                    </div>
                    <div className="text-[10px] text-[#64748B] w-28 text-right">
                      全体 {q.globalScore?.toFixed(2)} |{" "}
                      <span className={q.diff != null && q.diff <= -1.0 ? "text-[#991B1B] font-bold" : ""}>
                        差{q.diff != null && q.diff > 0 ? "+" : ""}{q.diff?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Director Gap */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm mb-8">
        <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">院長とのギャップ</h3>
        {data.directorResponse && gapData.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-[#64748B]">
              プラスは院長自己評価が高く、マイナスはスタッフ評価が高い状態です。
            </p>
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={gapData} margin={{ top: 12, right: 16, left: 12, bottom: 72 }}>
                <CartesianGrid vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="shortLabel"
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={84}
                  tick={{ fontSize: 11, fill: "#475569" }}
                />
                <YAxis
                  domain={[-3, 3]}
                  tickCount={7}
                  tick={{ fontSize: 11, fill: "#475569" }}
                  tickFormatter={(value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`}
                  label={{ value: "ギャップ値", angle: -90, position: "insideLeft", style: { fill: "#475569", fontSize: 12 } }}
                />
                <ReferenceLine y={0} stroke="#0F172A" strokeWidth={1.2} />
                <Tooltip content={<ClinicGapTooltip />} cursor={{ fill: "#F8FAFC" }} />
                <Bar dataKey="gap" radius={[6, 6, 0, 0]} maxBarSize={34}>
                  {gapData.map((item) => (
                    <Cell key={item.id} fill={getGapBarColor(item.gap)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <p className="text-sm text-[#94A3B8] py-8 text-center">院長回答なし</p>
        )}
      </div>

      {/* Individual Responses */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm mb-8">
        <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">個別回答一覧</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#E2E8F0]">
              <th className="text-left py-2 text-[#64748B]">日時</th>
              <th className="text-left py-2 text-[#64748B]">氏名</th>
              <th className="text-left py-2 text-[#64748B]">平均スコア</th>
              <th className="text-left py-2 text-[#64748B]">自由記入</th>
            </tr>
          </thead>
          <tbody>
            {data.responses.map((r) => (
              <tr key={r.id} className="border-b border-[#E2E8F0]/50 hover:bg-[#FAFBFC]">
                <td className="py-2 text-[#64748B]">{r.timestamp || "-"}</td>
                <td className="py-2 text-[#1E293B]">{r.name}</td>
                <td className="py-2"><ScoreBadge score={r.avgScore} size="sm" /></td>
                <td className="py-2">{r.freeText ? "💬" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Free Text */}
      {data.freeTexts.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
          <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">自由記入</h3>
          <div className="space-y-3">
            {data.freeTexts.map((ft, i) => (
              <div key={i} className="border-l-[3px] border-[#2563EB] bg-[#FAFBFC] rounded-r-lg p-4">
                <p className="text-sm text-[#1E293B] whitespace-pre-wrap">&ldquo;{ft.text}&rdquo;</p>
                <p className="text-[10px] text-[#64748B] mt-2">{ft.name} | {ft.timestamp || ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
