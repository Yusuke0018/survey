"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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

export default function GapClinicDetailPage() {
  const params = useParams();
  const { id: surveyId } = useSurveyContext();
  const clinicName = decodeURIComponent(params.clinicName as string);
  const [gaps, setGaps] = useState<GapData[]>([]);

  useEffect(() => {
    if (!surveyId) return;
    fetchJsonSafe(`/api/surveys/${surveyId}/gap`, Array.isArray, [] as GapData[]).then(setGaps);
  }, [surveyId]);

  const detail = useMemo(
    () => gaps.find((item) => item.clinic === clinicName) ?? null,
    [gaps, clinicName]
  );

  if (!surveyId) {
    return <div className="py-20 text-center text-[#64748B]">サーベイを選択してください</div>;
  }

  if (!detail) {
    return <div className="py-20 text-center text-[#64748B]">読み込み中...</div>;
  }

  const tone = getGapTone(detail.gapAvg);
  const positiveItems = getTopPositiveQuestions(detail);
  const negativeItems = getTopNegativeQuestions(detail);
  const alignedItems = getAlignedQuestions(detail);

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/gap?surveyId=${surveyId}`}
        className="inline-block text-sm text-[#2563EB] hover:underline"
      >
        ← ギャップ分析一覧に戻る
      </Link>

      <section className="rounded-[28px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Selected Clinic</p>
            <h3 className="mt-2 text-2xl font-bold text-[#0F172A]">{detail.clinic}</h3>
            <p className="mt-2 text-sm text-[#475569]">
              {tone.label}。最もズレが大きいのは Q{detail.maxGap.num}「{detail.maxGap.shortLabel}」です。
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${tone.chip}`}>
              平均ギャップ {detail.gapAvg > 0 ? "+" : ""}{detail.gapAvg.toFixed(2)}
            </div>
            <div className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[11px] font-medium text-[#475569]">
              一覧ではなく、この拠点の詳細ページを表示中です
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-[#F8FAFC] p-4">
            <p className="text-xs text-[#64748B]">院長自己評価</p>
            <div className="mt-2 flex items-center gap-3">
              <ScoreBadge score={detail.directorAvg} size="lg" />
              <p className="text-sm text-[#475569]">現場より高く見ているほど赤が強くなります</p>
            </div>
          </div>
          <div className="rounded-2xl bg-[#F8FAFC] p-4">
            <p className="text-xs text-[#64748B]">スタッフ平均</p>
            <div className="mt-2 flex items-center gap-3">
              <ScoreBadge score={detail.staffAvg} size="lg" />
              <p className="text-sm text-[#475569]">実際の体感値に近い基準として参照します</p>
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{ backgroundColor: tone.soft }}>
            <p className="text-xs text-[#64748B]">ズレの印象</p>
            <p className="mt-2 text-xl font-bold" style={{ color: tone.accent }}>
              {detail.gapAvg > 0 ? "+" : ""}{detail.gapAvg.toFixed(2)}
            </p>
            <p className="mt-1 text-sm text-[#475569]">{tone.label}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h4 className="text-lg font-semibold text-[#0F172A]">{detail.clinic} ギャップ</h4>
            <p className="text-sm text-[#64748B]">
              院長自己評価 - スタッフ平均。プラスは院長高評価、マイナスはスタッフ高評価です。
            </p>
          </div>
          <div className="text-xs text-[#64748B]">縦軸はギャップ値 / 0 を境に方向を確認</div>
        </div>

        <div className="mt-6 h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={detail.questionGaps}
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
                {detail.questionGaps.map((item) => (
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
  );
}
