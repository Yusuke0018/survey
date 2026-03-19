"use client";

import { useEffect, useState } from "react";
import { AreaBadge } from "@/components/area-badge";
import { ScoreBadge } from "@/components/score-badge";
import { useSurveyContext } from "@/components/survey-context";
import { fetchJsonSafe } from "@/lib/client-json";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AreaKey } from "@/lib/questions";

interface GapItem {
  id: string;
  num: number;
  shortLabel: string;
  area: AreaKey;
  areaLabel: string;
  staffScore: number | null;
  directorScore: number | null;
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

function getGapBarColor(gap: number | null) {
  if (gap == null) return "#CBD5E1";
  if (gap >= 1.0) return "#EF4444";
  if (gap >= 0.35) return "#FB7185";
  if (gap <= -1.0) return "#2563EB";
  if (gap <= -0.35) return "#38BDF8";
  return "#94A3B8";
}

function getGapSeverityScore(data: GapData) {
  return Math.abs(data.gapAvg) * 2 + Math.abs(data.maxGap.gap ?? 0);
}

function getTopPositiveQuestions(data: GapData) {
  return [...data.questionGaps]
    .filter((item) => item.gap != null && item.gap > 0)
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))
    .slice(0, 3);
}

function getTopNegativeQuestions(data: GapData) {
  return [...data.questionGaps]
    .filter((item) => item.gap != null && item.gap < 0)
    .sort((a, b) => (a.gap ?? 0) - (b.gap ?? 0))
    .slice(0, 3);
}

function getAlignedQuestions(data: GapData) {
  return [...data.questionGaps]
    .filter((item) => item.gap != null)
    .sort((a, b) => Math.abs(a.gap ?? 0) - Math.abs(b.gap ?? 0))
    .slice(0, 3);
}

function GapTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: GapItem }>;
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

function InsightList({
  title,
  subtitle,
  items,
  emptyLabel,
  direction,
}: {
  title: string;
  subtitle: string;
  items: GapItem[];
  emptyLabel: string;
  direction: "positive" | "negative" | "neutral";
}) {
  const accent =
    direction === "positive"
      ? "border-[#FECACA] bg-[#FEF2F2]"
      : direction === "negative"
        ? "border-[#BFDBFE] bg-[#EFF6FF]"
        : "border-[#D1FAE5] bg-[#F0FDF4]";

  return (
    <div className={`rounded-2xl border p-4 ${accent}`}>
      <div className="mb-3">
        <p className="text-sm font-semibold text-[#0F172A]">{title}</p>
        <p className="mt-1 text-xs text-[#64748B]">{subtitle}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[#64748B]">{emptyLabel}</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl bg-white/80 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#0F172A]">Q{item.num}</span>
                    <AreaBadge area={item.area} />
                  </div>
                  <p className="mt-1 text-sm text-[#334155]">{item.shortLabel}</p>
                </div>
                <div
                  className="rounded-lg px-2 py-1 text-sm font-[family-name:var(--font-inter)] font-bold"
                  style={{
                    color: getGapBarColor(item.gap),
                    backgroundColor: direction === "positive" ? "#FEE2E2" : direction === "negative" ? "#DBEAFE" : "#DCFCE7",
                  }}
                >
                  {item.gap != null ? `${item.gap > 0 ? "+" : ""}${item.gap.toFixed(2)}` : "-"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GapPage() {
  const { id: surveyId } = useSurveyContext();
  const [gaps, setGaps] = useState<GapData[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

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

  const selectedGap = gaps.find((item) => item.clinic === selected) ?? gaps[0];
  const selectedTone = getGapTone(selectedGap.gapAvg);
  const positiveItems = getTopPositiveQuestions(selectedGap);
  const negativeItems = getTopNegativeQuestions(selectedGap);
  const alignedItems = getAlignedQuestions(selectedGap);
  const highRiskCount = gaps.filter((item) => item.gapAvg >= 0.5).length;
  const mostPositive = [...gaps].sort((a, b) => b.gapAvg - a.gapAvg)[0];
  const mostNegative = [...gaps].sort((a, b) => a.gapAvg - b.gapAvg)[0];

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#F3E8FF] bg-[linear-gradient(135deg,#FFF7ED_0%,#FFFFFF_45%,#EFF6FF_100%)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C2410C]">Gap Analysis</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#0F172A]">院長自己評価とスタッフ平均のズレを直感で見る</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569]">
              プラスは院長自己評価が高く、マイナスはスタッフ評価が高い状態です。まずズレの大きい拠点を見つけ、右側の差分グラフでどの設問が原因かを見ます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-[#FECACA] bg-white/85 px-3 py-1.5 text-[#991B1B]">赤: 院長が高めに認識</span>
            <span className="rounded-full border border-[#BFDBFE] bg-white/85 px-3 py-1.5 text-[#1D4ED8]">青: スタッフのほうが高評価</span>
            <span className="rounded-full border border-[#D1FAE5] bg-white/85 px-3 py-1.5 text-[#166534]">0付近: 認識は一致</span>
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

      <section className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="rounded-[24px] border border-[#DBEAFE] bg-[linear-gradient(135deg,#EFF6FF_0%,#F8FAFC_100%)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Clinic Selector</p>
            <p className="mt-2 text-sm font-medium text-[#0F172A]">左の院カードを押すと、右側のグラフと分析コメントが切り替わります。</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-[#475569]">
              <span className="inline-flex h-6 items-center rounded-full bg-[#0F172A] px-2.5 font-semibold text-white">選択中</span>
              <span>現在は「{selectedGap.clinic}」を表示中です。</span>
            </div>
          </div>
          {gaps.map((gap) => {
            const tone = getGapTone(gap.gapAvg);
            const topBad = getTopPositiveQuestions(gap)[0];
            const isSelected = selectedGap.clinic === gap.clinic;

            return (
              <button
                key={gap.clinic}
                type="button"
                onClick={() => setSelected(gap.clinic)}
                className={`w-full rounded-[24px] border p-4 text-left transition-all ${
                  isSelected
                    ? "border-[#0F172A] bg-[#0F172A] text-white shadow-lg shadow-[#0F172A]/10 ring-2 ring-[#FDBA74]/60"
                    : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border text-[11px] font-bold ${
                          isSelected ? "border-white/30 bg-white/10 text-white" : "border-[#CBD5E1] bg-[#F8FAFC] text-[#475569]"
                        }`}
                      >
                        {isSelected ? "✓" : "→"}
                      </span>
                      <p className={`text-lg font-semibold ${isSelected ? "text-white" : "text-[#0F172A]"}`}>{gap.clinic}</p>
                    </div>
                    <p className={`mt-1 text-xs ${isSelected ? "text-white/70" : "text-[#64748B]"}`}>最大ギャップ Q{gap.maxGap.num} {gap.maxGap.shortLabel}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isSelected ? "border-white/20 bg-white/10 text-white" : tone.chip}`}>
                      {tone.label}
                    </span>
                    <span className={`text-[11px] font-medium ${isSelected ? "text-[#FDBA74]" : "text-[#64748B]"}`}>
                      {isSelected ? "右側に表示中" : "押すと右側を更新"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className={`rounded-2xl px-3 py-2 ${isSelected ? "bg-white/10" : "bg-[#F8FAFC]"}`}>
                    <p className={`text-[10px] ${isSelected ? "text-white/70" : "text-[#64748B]"}`}>院長</p>
                    <p className="mt-1 font-[family-name:var(--font-inter)] text-xl font-bold">{gap.directorAvg.toFixed(2)}</p>
                  </div>
                  <div className={`rounded-2xl px-3 py-2 ${isSelected ? "bg-white/10" : "bg-[#F8FAFC]"}`}>
                    <p className={`text-[10px] ${isSelected ? "text-white/70" : "text-[#64748B]"}`}>スタッフ</p>
                    <p className="mt-1 font-[family-name:var(--font-inter)] text-xl font-bold">{gap.staffAvg.toFixed(2)}</p>
                  </div>
                  <div
                    className="rounded-2xl px-3 py-2"
                    style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.12)" : tone.soft }}
                  >
                    <p className={`text-[10px] ${isSelected ? "text-white/70" : "text-[#64748B]"}`}>平均ギャップ</p>
                    <p className="mt-1 font-[family-name:var(--font-inter)] text-xl font-bold">
                      {gap.gapAvg > 0 ? "+" : ""}{gap.gapAvg.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className={`mb-1 flex items-center justify-between text-[11px] ${isSelected ? "text-white/70" : "text-[#64748B]"}`}>
                    <span>ズレの大きさ</span>
                    <span>{round2(getGapSeverityScore(gap)).toFixed(2)}</span>
                  </div>
                  <div className={`h-2 rounded-full ${isSelected ? "bg-white/10" : "bg-[#E2E8F0]"}`}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (getGapSeverityScore(gap) / 4) * 100)}%`,
                        backgroundColor: isSelected ? "#FDBA74" : tone.accent,
                      }}
                    />
                  </div>
                </div>

                <div className={`mt-4 rounded-2xl px-3 py-2 ${isSelected ? "bg-white/10" : "bg-[#F8FAFC]"}`}>
                  <p className={`text-[11px] font-medium ${isSelected ? "text-white/75" : "text-[#64748B]"}`}>今すぐ見るべき設問</p>
                  <p className={`mt-1 text-sm ${isSelected ? "text-white" : "text-[#0F172A]"}`}>
                    {topBad ? `Q${topBad.num} ${topBad.shortLabel} (${topBad.gap?.toFixed(2)})` : "大きなズレはありません"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Selected Clinic</p>
                <h3 className="mt-2 text-2xl font-bold text-[#0F172A]">{selectedGap.clinic}</h3>
                <p className="mt-2 text-sm text-[#475569]">
                  {selectedTone.label}。最もズレが大きいのは Q{selectedGap.maxGap.num}「{selectedGap.maxGap.shortLabel}」です。
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 lg:items-end">
                <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selectedTone.chip}`}>
                  平均ギャップ {selectedGap.gapAvg > 0 ? "+" : ""}{selectedGap.gapAvg.toFixed(2)}
                </div>
                <div className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[11px] font-medium text-[#475569]">
                  左の院カードを押すとこの内容が切り替わります
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-[#F8FAFC] p-4">
                <p className="text-xs text-[#64748B]">院長自己評価</p>
                <div className="mt-2 flex items-center gap-3">
                  <ScoreBadge score={selectedGap.directorAvg} size="lg" />
                  <p className="text-sm text-[#475569]">現場より高く見ているほど赤が強くなります</p>
                </div>
              </div>
              <div className="rounded-2xl bg-[#F8FAFC] p-4">
                <p className="text-xs text-[#64748B]">スタッフ平均</p>
                <div className="mt-2 flex items-center gap-3">
                  <ScoreBadge score={selectedGap.staffAvg} size="lg" />
                  <p className="text-sm text-[#475569]">実際の体感値に近い基準として参照します</p>
                </div>
              </div>
              <div className="rounded-2xl p-4" style={{ backgroundColor: selectedTone.soft }}>
                <p className="text-xs text-[#64748B]">ズレの印象</p>
                <p className="mt-2 text-xl font-bold" style={{ color: selectedTone.accent }}>
                  {selectedGap.gapAvg > 0 ? "+" : ""}{selectedGap.gapAvg.toFixed(2)}
                </p>
                <p className="mt-1 text-sm text-[#475569]">{selectedTone.label}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h4 className="text-lg font-semibold text-[#0F172A]">{selectedGap.clinic} ギャップ</h4>
                <p className="text-sm text-[#64748B]">
                  院長自己評価 - スタッフ平均。プラスは院長高評価、マイナスはスタッフ高評価です。
                </p>
              </div>
              <div className="text-xs text-[#64748B]">縦軸はギャップ値 / 0 を境に方向を確認</div>
            </div>

            <div className="mt-6 h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={selectedGap.questionGaps}
                  margin={{ top: 12, right: 16, left: 12, bottom: 64 }}
                >
                  <CartesianGrid vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="shortLabel"
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={78}
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
                  <Tooltip content={<GapTooltip />} cursor={{ fill: "#F8FAFC" }} />
                  <Bar dataKey="gap" radius={[6, 6, 0, 0]} maxBarSize={34}>
                    {selectedGap.questionGaps.map((item) => (
                      <Cell key={item.id} fill={getGapBarColor(item.gap)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <InsightList
              title="院長が高く見ている項目"
              subtitle="現場体感より自己評価が上振れしている設問"
              items={positiveItems}
              emptyLabel="大きな上振れはありません。"
              direction="positive"
            />
            <InsightList
              title="スタッフのほうが高い項目"
              subtitle="現場のほうが良く感じている設問"
              items={negativeItems}
              emptyLabel="スタッフ優位の項目はありません。"
              direction="negative"
            />
            <InsightList
              title="認識が揃っている項目"
              subtitle="まず共通認識を起点に対話できる設問"
              items={alignedItems}
              emptyLabel="一致項目がありません。"
              direction="neutral"
            />
          </section>
        </div>
      </section>
    </div>
  );
}
