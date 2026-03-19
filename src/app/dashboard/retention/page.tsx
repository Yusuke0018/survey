"use client";

import { useEffect, useState } from "react";
import { ScoreBadge } from "@/components/score-badge";
import { useSurveyContext } from "@/components/survey-context";
import { fetchJsonSafe, isRecord } from "@/lib/client-json";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Label,
} from "recharts";

interface RetentionData {
  unit: string;
  xScore: number;
  yScore: number;
  overallAvg: number;
  count: number;
  label: string;
  level: "critical" | "warning-manager" | "warning-other" | "good";
}

interface RetentionResponse {
  surveyType: "clinic" | "jigyotai";
  unitLabel: string;
  xQuestionNum: number;
  yQuestionNum: number;
  xLabel: string;
  yLabel: string;
  data: RetentionData[];
}

const EMPTY_RETENTION_RESPONSE: RetentionResponse = {
  surveyType: "clinic",
  unitLabel: "拠点",
  xQuestionNum: 7,
  yQuestionNum: 15,
  xLabel: "相談しやすい",
  yLabel: "継続意向",
  data: [],
};

function isRetentionResponse(value: unknown): value is RetentionResponse {
  return isRecord(value) && Array.isArray(value.data);
}

function getLevelColor(level: string) {
  switch (level) {
    case "critical": return "#EF4444";
    case "warning-manager": return "#F59E0B";
    case "warning-other": return "#F59E0B";
    case "good": return "#22C55E";
    default: return "#94A3B8";
  }
}

function getLevelBg(level: string) {
  switch (level) {
    case "critical": return "#FEE2E2";
    case "warning-manager": return "#FEF9C3";
    case "warning-other": return "#FEF9C3";
    case "good": return "#DCFCE7";
    default: return "#F1F5F9";
  }
}

function getLevelIcon(level: string) {
  switch (level) {
    case "critical": return "⚠️";
    case "warning-manager": return "△";
    case "warning-other": return "△";
    case "good": return "○";
    default: return "";
  }
}

function RetentionTooltip({
  active,
  payload,
  xLabel,
  yLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload: RetentionData }>;
  xLabel: string;
  yLabel: string;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0].payload;
  return (
    <div className="bg-white shadow-lg rounded-lg p-3 border border-[#E2E8F0] text-xs">
      <p className="font-semibold text-[#1E293B]">{point.unit}</p>
      <p className="text-[#64748B]">{xLabel}: {point.xScore.toFixed(2)}</p>
      <p className="text-[#64748B]">{yLabel}: {point.yScore.toFixed(2)}</p>
      <p className="mt-1" style={{ color: getLevelColor(point.level) }}>{point.label}</p>
    </div>
  );
}

export default function RetentionPage() {
  const { id: surveyId, type: surveyType } = useSurveyContext();
  const [response, setResponse] = useState<RetentionResponse | null>(null);

  useEffect(() => {
    if (!surveyId) return;
    fetchJsonSafe(`/api/surveys/${surveyId}/retention`, isRetentionResponse, EMPTY_RETENTION_RESPONSE).then(setResponse);
  }, [surveyId]);

  if (!surveyId) {
    return <div className="text-center py-20 text-[#64748B]">サーベイを選択してください</div>;
  }

  const data = response?.data ?? [];
  const xLabel = response?.xLabel || "相談しやすい";
  const yLabel = response?.yLabel || "継続意向";
  const xQuestionNum = response?.xQuestionNum || 7;
  const yQuestionNum = response?.yQuestionNum || (surveyType === "jigyotai" ? 19 : 15);
  const unitLabel = response?.unitLabel || (surveyType === "jigyotai" ? "事業体" : "拠点");

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#1E293B] mb-6">離職リスク分析</h2>

      {/* Scatter Plot */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm mb-8">
        <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">
          Q{xQuestionNum}（{xLabel}）× Q{yQuestionNum}（{yLabel}）散布図
        </h3>
        <ResponsiveContainer width="100%" height={450}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis
              type="number"
              dataKey="xScore"
              domain={[1, 5]}
              tick={{ fontSize: 11 }}
              name={xLabel}
            >
              <Label value={`Q${xQuestionNum} ${xLabel} →`} position="bottom" offset={0} style={{ fontSize: 11, fill: "#64748B" }} />
            </XAxis>
            <YAxis
              type="number"
              dataKey="yScore"
              domain={[1, 5]}
              tick={{ fontSize: 11 }}
              name={yLabel}
            >
              <Label value={`Q${yQuestionNum} ${yLabel} →`} angle={-90} position="insideLeft" offset={5} style={{ fontSize: 11, fill: "#64748B" }} />
            </YAxis>
            <ReferenceLine x={3} stroke="#94A3B8" strokeDasharray="4 4" />
            <ReferenceLine y={3} stroke="#94A3B8" strokeDasharray="4 4" />
            <Tooltip content={<RetentionTooltip xLabel={xLabel} yLabel={yLabel} />} />
            <Scatter data={data} animationDuration={800}>
              {data.map((d, i) => (
                <Cell key={i} fill={getLevelColor(d.level)} r={8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex items-center gap-6 justify-center mt-4 text-xs text-[#64748B]">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#EF4444]" /> 要緊急対応</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#F59E0B]" /> 注意</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#22C55E]" /> 概ね良好</span>
        </div>
      </div>

      {/* Clinic Cards */}
      <div className="grid grid-cols-2 gap-4">
        {data
          .sort((a, b) => {
            const order = { critical: 0, "warning-manager": 1, "warning-other": 2, good: 3 };
            return order[a.level] - order[b.level];
          })
          .map((d) => (
          <div
            key={d.unit}
            className="rounded-xl border p-4 shadow-sm"
            style={{
              backgroundColor: getLevelBg(d.level),
              borderColor: getLevelColor(d.level) + "40",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-[#1E293B]">{d.unit}</h4>
              <span className="text-lg">{getLevelIcon(d.level)}</span>
            </div>
            <p className="text-xs font-medium mb-2" style={{ color: getLevelColor(d.level) }}>{d.label}</p>
            <div className="flex gap-4 text-xs text-[#64748B]">
              <span>Q{xQuestionNum}: {d.xScore.toFixed(2)}</span>
              <span>Q{yQuestionNum}: {d.yScore.toFixed(2)}</span>
              <span>全体平均: <ScoreBadge score={d.overallAvg} size="sm" /></span>
              <span>{unitLabel}回答: {d.count}件</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
