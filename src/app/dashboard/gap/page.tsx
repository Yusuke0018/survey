"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSurveyContext } from "@/components/survey-context";
import { fetchJsonSafe } from "@/lib/client-json";

interface GapItem {
  id: string;
  num: number;
  shortLabel: string;
  gap: number | null;
}

interface GapData {
  clinic: string;
  staffAvg: number;
  directorAvg: number;
  gapAvg: number;
  maxGap: { num: number; gap: number | null; shortLabel: string };
  questionGaps: GapItem[];
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function getGapTone(gap: number) {
  if (gap >= 1.0) {
    return {
      label: "院長がかなり高めに見ている",
      chip: "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]",
      accent: "#DC2626",
      soft: "#FEF2F2",
    };
  }
  if (gap >= 0.35) {
    return {
      label: "院長がやや高めに見ている",
      chip: "bg-[#FFF7ED] text-[#9A3412] border-[#FED7AA]",
      accent: "#EA580C",
      soft: "#FFF7ED",
    };
  }
  if (gap <= -1.0) {
    return {
      label: "スタッフのほうが高い",
      chip: "bg-[#DBEAFE] text-[#1D4ED8] border-[#BFDBFE]",
      accent: "#2563EB",
      soft: "#EFF6FF",
    };
  }
  if (gap <= -0.35) {
    return {
      label: "ほぼ一致だがスタッフ優位",
      chip: "bg-[#E0F2FE] text-[#0C4A6E] border-[#BAE6FD]",
      accent: "#0284C7",
      soft: "#F0F9FF",
    };
  }
  return {
    label: "おおむね一致",
    chip: "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]",
    accent: "#16A34A",
    soft: "#F0FDF4",
  };
}

function getGapSeverityScore(data: GapData) {
  return Math.abs(data.gapAvg) * 2 + Math.abs(data.maxGap.gap ?? 0);
}

function getTopPositiveQuestion(data: GapData) {
  return [...data.questionGaps]
    .filter((item) => item.gap != null && item.gap > 0)
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0] ?? null;
}

export default function GapPage() {
  const { id: surveyId } = useSurveyContext();
  const [gaps, setGaps] = useState<GapData[]>([]);

  useEffect(() => {
    if (!surveyId) return;
    fetchJsonSafe(`/api/surveys/${surveyId}/gap`, Array.isArray, [] as GapData[]).then((data) => {
      const sorted = [...data].sort((a, b) => getGapSeverityScore(b) - getGapSeverityScore(a));
      setGaps(sorted);
    });
  }, [surveyId]);

  if (!surveyId) {
    return <div className="py-20 text-center text-[#64748B]">サーベイを選択してください</div>;
  }

  if (gaps.length === 0) {
    return <div className="py-20 text-center text-[#64748B]">院長回答のある拠点がありません</div>;
  }

  const highRiskCount = gaps.filter((item) => item.gapAvg >= 0.5).length;
  const mostPositive = [...gaps].sort((a, b) => b.gapAvg - a.gapAvg)[0];
  const mostNegative = [...gaps].sort((a, b) => a.gapAvg - b.gapAvg)[0];

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#F3E8FF] bg-[linear-gradient(135deg,#FFF7ED_0%,#FFFFFF_45%,#EFF6FF_100%)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C2410C]">Gap Analysis</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#0F172A]">ギャップが大きい拠点から詳細へ入る</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569]">
              一覧ではズレが大きい拠点を並べ、各カードを押すと詳細ページへ移動します。詳細ページでは差分グラフと、どの設問がズレの原因かを確認できます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-[#FECACA] bg-white/85 px-3 py-1.5 text-[#991B1B]">赤: 院長が高めに認識</span>
            <span className="rounded-full border border-[#BFDBFE] bg-white/85 px-3 py-1.5 text-[#1D4ED8]">青: スタッフのほうが高評価</span>
            <span className="rounded-full border border-[#D1FAE5] bg-white/85 px-3 py-1.5 text-[#166534]">緑: 認識は近い</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-[#64748B]">比較対象の拠点</p>
          <p className="mt-3 font-[family-name:var(--font-inter)] text-3xl font-bold text-[#0F172A]">{gaps.length}</p>
          <p className="mt-2 text-sm text-[#64748B]">院長回答がある拠点のみ表示</p>
        </div>
        <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-5 shadow-sm">
          <p className="text-xs font-medium text-[#991B1B]">要確認の拠点</p>
          <p className="mt-3 font-[family-name:var(--font-inter)] text-3xl font-bold text-[#7F1D1D]">{highRiskCount}</p>
          <p className="mt-2 text-sm text-[#B91C1C]">平均ギャップが +0.50 以上</p>
        </div>
        <div className="rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-5 shadow-sm">
          <p className="text-xs font-medium text-[#9A3412]">最もズレが大きい拠点</p>
          <p className="mt-3 text-lg font-bold text-[#7C2D12]">{mostPositive.clinic}</p>
          <p className="mt-2 text-sm text-[#9A3412]">平均ギャップ {mostPositive.gapAvg > 0 ? "+" : ""}{mostPositive.gapAvg.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-5 shadow-sm">
          <p className="text-xs font-medium text-[#1D4ED8]">スタッフ評価が上回る拠点</p>
          <p className="mt-3 text-lg font-bold text-[#1E3A8A]">{mostNegative.clinic}</p>
          <p className="mt-2 text-sm text-[#1D4ED8]">平均ギャップ {mostNegative.gapAvg > 0 ? "+" : ""}{mostNegative.gapAvg.toFixed(2)}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {gaps.map((gap) => {
          const tone = getGapTone(gap.gapAvg);
          const topBad = getTopPositiveQuestion(gap);
          return (
            <Link
              key={gap.clinic}
              href={`/dashboard/gap/${encodeURIComponent(gap.clinic)}?surveyId=${surveyId}`}
              className="rounded-[24px] border border-[#E2E8F0] bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-[#0F172A]">{gap.clinic}</p>
                  <p className="mt-1 text-xs text-[#64748B]">最大ギャップ Q{gap.maxGap.num} {gap.maxGap.shortLabel}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone.chip}`}>
                  {tone.label}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-[#F8FAFC] px-3 py-2">
                  <p className="text-[10px] text-[#64748B]">院長</p>
                  <p className="mt-1 font-[family-name:var(--font-inter)] text-xl font-bold text-[#0F172A]">{gap.directorAvg.toFixed(2)}</p>
                </div>
                <div className="rounded-2xl bg-[#F8FAFC] px-3 py-2">
                  <p className="text-[10px] text-[#64748B]">スタッフ</p>
                  <p className="mt-1 font-[family-name:var(--font-inter)] text-xl font-bold text-[#0F172A]">{gap.staffAvg.toFixed(2)}</p>
                </div>
                <div className="rounded-2xl px-3 py-2" style={{ backgroundColor: tone.soft }}>
                  <p className="text-[10px] text-[#64748B]">平均ギャップ</p>
                  <p className="mt-1 font-[family-name:var(--font-inter)] text-xl font-bold" style={{ color: tone.accent }}>
                    {gap.gapAvg > 0 ? "+" : ""}{gap.gapAvg.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[11px] text-[#64748B]">
                  <span>ズレの大きさ</span>
                  <span>{round2(getGapSeverityScore(gap)).toFixed(2)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#E2E8F0]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (getGapSeverityScore(gap) / 4) * 100)}%`,
                      backgroundColor: tone.accent,
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-[#F8FAFC] px-3 py-2">
                <p className="text-[11px] font-medium text-[#64748B]">今すぐ見るべき設問</p>
                <p className="mt-1 text-sm text-[#0F172A]">
                  {topBad ? `Q${topBad.num} ${topBad.shortLabel} (${topBad.gap?.toFixed(2)})` : "大きなズレはありません"}
                </p>
              </div>

              <div className="mt-4 inline-flex items-center rounded-full bg-[#0F172A] px-3 py-1.5 text-[11px] font-semibold text-white">
                詳細を見る →
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
