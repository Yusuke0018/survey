"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ScoreBadge } from "@/components/score-badge";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Label,
} from "recharts";

interface RetentionData {
  clinic: string;
  q7: number;
  q15: number;
  overallAvg: number;
  count: number;
  label: string;
  level: "critical" | "warning-director" | "warning-other" | "good";
}

export default function RetentionPage() {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get("surveyId");
  const [data, setData] = useState<RetentionData[]>([]);

  useEffect(() => {
    if (!surveyId) return;
    fetch(`/api/surveys/${surveyId}/retention`).then((r) => r.json()).then(setData);
  }, [surveyId]);

  if (!surveyId) {
    return <div className="text-center py-20 text-[#64748B]">サーベイを選択してください</div>;
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "critical": return "#EF4444";
      case "warning-director": return "#F59E0B";
      case "warning-other": return "#F59E0B";
      case "good": return "#22C55E";
      default: return "#94A3B8";
    }
  };

  const getLevelBg = (level: string) => {
    switch (level) {
      case "critical": return "#FEE2E2";
      case "warning-director": return "#FEF9C3";
      case "warning-other": return "#FEF9C3";
      case "good": return "#DCFCE7";
      default: return "#F1F5F9";
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "critical": return "⚠️";
      case "warning-director": return "△";
      case "warning-other": return "△";
      case "good": return "○";
      default: return "";
    }
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: RetentionData }> }) => {
    if (active && payload && payload.length > 0) {
      const d = payload[0].payload;
      return (
        <div className="bg-white shadow-lg rounded-lg p-3 border border-[#E2E8F0] text-xs">
          <p className="font-semibold text-[#1E293B]">{d.clinic}</p>
          <p className="text-[#64748B]">Q7（相談しやすい）: {d.q7.toFixed(2)}</p>
          <p className="text-[#64748B]">Q15（継続意向）: {d.q15.toFixed(2)}</p>
          <p className="mt-1" style={{ color: getLevelColor(d.level) }}>{d.label}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#1E293B] mb-6">離職リスク分析</h2>

      {/* Scatter Plot */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm mb-8">
        <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">
          Q7（院長への相談しやすさ）× Q15（継続意向）散布図
        </h3>
        <ResponsiveContainer width="100%" height={450}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis
              type="number"
              dataKey="q7"
              domain={[1, 5]}
              tick={{ fontSize: 11 }}
              name="Q7 相談しやすい"
            >
              <Label value="Q7 院長に相談しやすい →" position="bottom" offset={0} style={{ fontSize: 11, fill: "#64748B" }} />
            </XAxis>
            <YAxis
              type="number"
              dataKey="q15"
              domain={[1, 5]}
              tick={{ fontSize: 11 }}
              name="Q15 継続意向"
            >
              <Label value="Q15 働き続けたい →" angle={-90} position="insideLeft" offset={5} style={{ fontSize: 11, fill: "#64748B" }} />
            </YAxis>
            <ReferenceLine x={3} stroke="#94A3B8" strokeDasharray="4 4" />
            <ReferenceLine y={3} stroke="#94A3B8" strokeDasharray="4 4" />
            <Tooltip content={<CustomTooltip />} />
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
            const order = { critical: 0, "warning-director": 1, "warning-other": 2, good: 3 };
            return order[a.level] - order[b.level];
          })
          .map((d) => (
          <div
            key={d.clinic}
            className="rounded-xl border p-4 shadow-sm"
            style={{
              backgroundColor: getLevelBg(d.level),
              borderColor: getLevelColor(d.level) + "40",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-[#1E293B]">{d.clinic}</h4>
              <span className="text-lg">{getLevelIcon(d.level)}</span>
            </div>
            <p className="text-xs font-medium mb-2" style={{ color: getLevelColor(d.level) }}>{d.label}</p>
            <div className="flex gap-4 text-xs text-[#64748B]">
              <span>Q7: {d.q7.toFixed(2)}</span>
              <span>Q15: {d.q15.toFixed(2)}</span>
              <span>全体平均: <ScoreBadge score={d.overallAvg} size="sm" /></span>
              <span>回答: {d.count}名</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
