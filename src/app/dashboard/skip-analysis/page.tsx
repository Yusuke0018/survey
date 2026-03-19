"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getEntityShortName } from "@/lib/entities";
import { SKIP_OPTIONS } from "@/lib/jigyotai-questions";

interface SkipRow {
  questionId: number;
  num: number;
  text: string;
  shortLabel: string;
  area: string;
  respondentType: string;
  skipOptions: string;
  entities: Record<string, {
    skipCount: number;
    totalResponses: number;
    skipRate: number;
    reasons: Record<string, number>;
  }>;
}

interface SkipData {
  entities: string[];
  rows: SkipRow[];
}

export default function SkipAnalysisPage() {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get("surveyId");
  const [data, setData] = useState<SkipData | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    if (!surveyId) return;
    fetch(`/api/surveys/${surveyId}/jg-skip`).then((r) => r.json()).then(setData);
  }, [surveyId]);

  if (!surveyId) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243" />
          </svg>
        </div>
        <p className="text-[#6B7280] text-sm">サーベイを選択してください</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full" />
        <span className="ml-3 text-sm text-[#6B7280]">読み込み中...</span>
      </div>
    );
  }

  if (data.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-[#6B7280] text-sm">スキップ対象の質問がありません</p>
      </div>
    );
  }

  const respondentTypes = [...new Set(data.rows.map((r) => r.respondentType))];
  const filteredRows = filterType === "all"
    ? data.rows
    : data.rows.filter((r) => r.respondentType === filterType);

  const getSkipCellBg = (rate: number) => {
    if (rate >= 80) return "#FEE2E2";
    if (rate >= 50) return "#FEF9C3";
    if (rate >= 20) return "#FEF3C7";
    return "transparent";
  };

  const getSkipCellColor = (rate: number) => {
    if (rate >= 80) return "#991B1B";
    if (rate >= 50) return "#854D0E";
    if (rate >= 20) return "#92400E";
    return "#6B7280";
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "staff": return "スタッフ";
      case "manager": return "責任者";
      case "corporate": return "経営企画室";
      default: return type;
    }
  };

  // Summary stats
  const totalSkips = data.rows.reduce((sum, row) => {
    return sum + data.entities.reduce((s, e) => s + (row.entities[e]?.skipCount || 0), 0);
  }, 0);

  const highSkipCells = data.rows.reduce((sum, row) => {
    return sum + data.entities.filter((e) => (row.entities[e]?.skipRate || 0) >= 50).length;
  }, 0);

  return (
    <div>
      <h2 className="text-xl font-bold text-[#111827] mb-6">スキップ分析</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
          <div className="text-xs text-[#6B7280] mb-2">スキップ対象質問数</div>
          <div className="font-[family-name:var(--font-inter)] text-3xl font-bold text-[#111827]">
            {data.rows.length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
          <div className="text-xs text-[#6B7280] mb-2">総スキップ回数</div>
          <div className="font-[family-name:var(--font-inter)] text-3xl font-bold text-[#F59E0B]">
            {totalSkips}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
          <div className="text-xs text-[#6B7280] mb-2">高スキップ率セル（50%以上）</div>
          <div className="font-[family-name:var(--font-inter)] text-3xl font-bold text-[#DC2626]">
            {highSkipCells}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setFilterType("all")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            filterType === "all"
              ? "bg-[#10B981] text-white shadow-sm"
              : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
          }`}
        >
          全て
        </button>
        {respondentTypes.map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filterType === type
                ? "bg-[#10B981] text-white shadow-sm"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            }`}
          >
            {typeLabel(type)}
          </button>
        ))}
      </div>

      {/* Skip Matrix Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#111827] mb-4">事業体 x 質問 スキップ率マトリクス</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="text-left p-2 text-[#9CA3AF] sticky left-0 bg-white">対象</th>
                <th className="text-left p-2 text-[#9CA3AF] sticky left-12 bg-white">Q</th>
                <th className="text-left p-2 text-[#9CA3AF]">項目</th>
                <th className="text-left p-2 text-[#9CA3AF]">領域</th>
                {data.entities.map((e) => (
                  <th
                    key={e}
                    className="p-1 text-center font-medium text-[#6B7280]"
                    style={{ writingMode: "vertical-rl", textOrientation: "mixed", height: 70, fontSize: 10 }}
                  >
                    {getEntityShortName(e)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const isNewType = idx === 0 || filteredRows[idx - 1].respondentType !== row.respondentType;
                return (
                  <tr key={`${row.respondentType}-${row.num}`} className={isNewType ? "border-t-2 border-[#E5E7EB]" : ""}>
                    <td className="p-2 text-[#9CA3AF] whitespace-nowrap sticky left-0 bg-white">
                      {isNewType ? typeLabel(row.respondentType) : ""}
                    </td>
                    <td className="p-2 text-[#374151]">Q{row.num}</td>
                    <td className="p-2 text-[#374151] max-w-[120px] truncate" title={row.text}>
                      {row.shortLabel}
                    </td>
                    <td className="p-2 text-[#9CA3AF] whitespace-nowrap">{row.area}</td>
                    {data.entities.map((e) => {
                      const cell = row.entities[e];
                      const rate = cell?.skipRate || 0;
                      const count = cell?.skipCount || 0;
                      return (
                        <td
                          key={e}
                          className="p-1 text-center font-[family-name:var(--font-inter)] font-semibold"
                          style={{
                            backgroundColor: getSkipCellBg(rate),
                            color: getSkipCellColor(rate),
                            fontSize: 11,
                          }}
                          title={count > 0
                            ? Object.entries(cell?.reasons || {}).map(([r, c]) =>
                                `${(SKIP_OPTIONS as Record<string, string>)[r] || r}: ${c}件`
                              ).join("\n")
                            : ""
                          }
                        >
                          {count > 0 ? `${rate}%` : "-"}
                          {count > 0 && <div className="text-[8px] font-normal">({count}件)</div>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-[10px] text-[#6B7280]">
          <span>スキップ率:</span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-3 rounded" style={{ backgroundColor: "#FEE2E2" }} />80%以上
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-3 rounded" style={{ backgroundColor: "#FEF9C3" }} />50〜80%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-3 rounded" style={{ backgroundColor: "#FEF3C7" }} />20〜50%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-3 rounded border border-[#E5E7EB]" />20%未満
          </span>
        </div>

        {/* Skip Reason Legend */}
        <div className="mt-3 pt-3 border-t border-[#F3F4F6]">
          <div className="text-[10px] text-[#9CA3AF] mb-1">スキップ理由（セルにカーソルを合わせて確認）:</div>
          <div className="flex items-center gap-4 text-[10px] text-[#6B7280]">
            {Object.entries(SKIP_OPTIONS).map(([key, label]) => (
              <span key={key}>{key}: {label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
