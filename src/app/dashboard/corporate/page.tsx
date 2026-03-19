"use client";

import { useEffect, useState } from "react";
import { useSurveyContext } from "@/components/survey-context";
import { fetchJsonSafe, isRecord } from "@/lib/client-json";
import { ScoreBadge } from "@/components/score-badge";
import { ScoreBar } from "@/components/score-bar";
import { getEntityShortName, getEntityGroupColor } from "@/lib/entities";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
} from "recharts";

interface CorporateScore {
  num: number;
  shortLabel: string;
  area: string;
  score: number | null;
}

interface EntityCorporate {
  entity: string;
  overallAvg: number;
  areaAverages: Array<{ area: string; score: number }>;
  scores: CorporateScore[];
  comments: string[];
}

interface CorporateData {
  overallAvg: number;
  overallScores: CorporateScore[];
  entities: EntityCorporate[];
  allComments: Array<{ entity: string; free_text: string }>;
}

const EMPTY_CORPORATE_DATA: CorporateData = {
  overallAvg: 0,
  overallScores: [],
  entities: [],
  allComments: [],
};

function isCorporateData(value: unknown): value is CorporateData {
  return isRecord(value)
    && typeof value.overallAvg === "number"
    && Array.isArray(value.overallScores)
    && Array.isArray(value.entities)
    && Array.isArray(value.allComments);
}

export default function CorporatePage() {
  const { id: surveyId } = useSurveyContext();
  const [data, setData] = useState<CorporateData | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  useEffect(() => {
    if (!surveyId) return;
    fetchJsonSafe(`/api/surveys/${surveyId}/jg-corporate`, isCorporateData, EMPTY_CORPORATE_DATA)
      .then((d: CorporateData) => {
        setData(d);
        if (d.entities.length > 0 && !selectedEntity) setSelectedEntity(d.entities[0].entity);
      });
  }, [surveyId, selectedEntity]);

  if (!surveyId) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

  const getBarColor = (score: number) => {
    if (score >= 3.5) return "#10B981";
    if (score >= 3.0) return "#F59E0B";
    return "#EF4444";
  };

  const selected = data.entities.find((e) => e.entity === selectedEntity);

  return (
    <div>
      <h2 className="text-xl font-bold text-[#111827] mb-6">経営企画室ダッシュボード</h2>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
          <div className="text-xs text-[#6B7280] mb-2">経営企画室 全体平均</div>
          <ScoreBadge score={data.overallAvg} size="lg" />
        </div>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
          <div className="text-xs text-[#6B7280] mb-2">評価対象事業体数</div>
          <div className="font-[family-name:var(--font-inter)] text-3xl font-bold text-[#111827]">
            {data.entities.length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
          <div className="text-xs text-[#6B7280] mb-2">コメント数</div>
          <div className="font-[family-name:var(--font-inter)] text-3xl font-bold text-[#111827]">
            {data.allComments.length}
          </div>
        </div>
      </div>

      {/* Entity Score Comparison */}
      {data.entities.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm mb-8">
          <h3 className="text-sm font-semibold text-[#111827] mb-4">事業体別 経営企画室評価</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, data.entities.length * 32)}>
            <BarChart
              data={[...data.entities].sort((a, b) => b.overallAvg - a.overallAvg).map((e) => ({
                name: getEntityShortName(e.entity),
                score: e.overallAvg,
                entity: e.entity,
              }))}
              layout="vertical"
              margin={{ left: 100, right: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: "#9CA3AF" }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#374151" }} width={100} />
              <Tooltip
                formatter={(value) => [typeof value === "number" ? value.toFixed(2) : value, "スコア"]}
                contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12 }}
              />
              <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={20}>
                {[...data.entities].sort((a, b) => b.overallAvg - a.overallAvg).map((e, i) => (
                  <Cell key={i} fill={getBarColor(e.overallAvg)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Entity Detail */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {/* Entity Selector */}
        <div className="col-span-1 space-y-2">
          <div className="text-xs font-semibold text-[#9CA3AF] mb-3">事業体を選択</div>
          {data.entities.map((e) => (
            <button
              key={e.entity}
              onClick={() => setSelectedEntity(e.entity)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all border ${
                selectedEntity === e.entity
                  ? "bg-[#ECFDF5] border-[#10B981] text-[#059669] font-medium"
                  : "bg-white border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{getEntityShortName(e.entity)}</span>
                <ScoreBadge score={e.overallAvg} size="sm" />
              </div>
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="col-span-3">
          {selected && (
            <div className="space-y-6">
              {/* Radar */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-[#111827] mb-4">
                  {selected.entity} - 領域別評価
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={selected.areaAverages}>
                      <PolarGrid stroke="#E5E7EB" />
                      <PolarAngleAxis dataKey="area" tick={{ fontSize: 10, fill: "#6B7280" }} />
                      <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} />
                      <Radar
                        dataKey="score"
                        stroke="#8B5CF6"
                        fill="#8B5CF6"
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                      <Tooltip formatter={(v) => [typeof v === "number" ? v.toFixed(2) : v, "スコア"]} />
                    </RadarChart>
                  </ResponsiveContainer>

                  <div className="space-y-2">
                    {selected.scores.map((s) => (
                      <div key={s.num} className="flex items-center gap-2">
                        <span className="text-[10px] text-[#9CA3AF] w-7">Q{s.num}</span>
                        <span className="text-[10px] text-[#374151] flex-1 truncate">{s.shortLabel}</span>
                        <div className="w-24 flex-shrink-0">
                          <ScoreBar score={s.score} showValue={false} />
                        </div>
                        <ScoreBadge score={s.score} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Comments */}
              {selected.comments.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-[#111827] mb-4">自由記述コメント</h3>
                  <div className="space-y-3">
                    {selected.comments.map((comment, i) => (
                      <div key={i} className="bg-[#F9FAFB] rounded-lg p-4 text-sm text-[#374151]">
                        {comment}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* All Comments */}
      {data.allComments.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-[#111827] mb-4">全事業体 自由記述一覧</h3>
          <div className="space-y-3">
            {data.allComments.map((c, i) => (
              <div key={i} className="bg-[#F9FAFB] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-md font-medium text-white"
                    style={{ backgroundColor: getEntityGroupColor(c.entity) }}
                  >
                    {getEntityShortName(c.entity)}
                  </span>
                </div>
                <p className="text-sm text-[#374151]">{c.free_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
