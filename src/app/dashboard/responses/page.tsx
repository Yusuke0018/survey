"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ScoreBadge } from "@/components/score-badge";
import { AreaBadge } from "@/components/area-badge";
import { CLINICS } from "@/lib/clinics";
import type { AreaKey } from "@/lib/questions";

interface ResponseItem {
  id: number;
  timestamp: string;
  clinic: string;
  name: string;
  avgScore: number;
  lowestQuestion: string | null;
  lowestScore: number | null;
  hasFreeText: boolean;
  scores: Array<{ id: string; num: number; value: number | null }>;
}

interface ResponseDetail {
  id: number;
  timestamp: string;
  clinic: string;
  name: string;
  avgScore: number;
  freeText: string | null;
  questions: Array<{
    id: string; num: number; text: string; shortLabel: string;
    area: AreaKey; areaLabel: string; areaColor: string;
    value: number | null; clinicAvg: number | null; diff: number | null;
  }>;
}

export default function ResponsesPage() {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get("surveyId");
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [clinicFilter, setClinicFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ResponseDetail | null>(null);
  const [tab, setTab] = useState<"list" | "freetext">("list");
  const [freeTexts, setFreeTexts] = useState<Array<{ id: number; clinic: string; name: string; timestamp: string; text: string }>>([]);

  useEffect(() => {
    if (!surveyId) return;
    const params = clinicFilter ? `?clinic=${encodeURIComponent(clinicFilter)}` : "";
    fetch(`/api/surveys/${surveyId}/responses${params}`).then((r) => r.json()).then(setResponses);
    fetch(`/api/surveys/${surveyId}/free-text${params}`).then((r) => r.json()).then(setFreeTexts);
  }, [surveyId, clinicFilter]);

  useEffect(() => {
    if (!surveyId || !selectedId) return;
    fetch(`/api/surveys/${surveyId}/responses/${selectedId}`).then((r) => r.json()).then(setDetail);
  }, [surveyId, selectedId]);

  if (!surveyId) {
    return <div className="text-center py-20 text-[#64748B]">サーベイを選択してください</div>;
  }

  const grouped: Record<string, typeof detail extends null ? never : NonNullable<typeof detail>["questions"]> = {};
  if (detail) {
    for (const q of detail.questions) {
      if (!grouped[q.area]) grouped[q.area] = [];
      grouped[q.area].push(q);
    }
  }

  return (
    <div className="relative">
      <h2 className="text-2xl font-bold text-[#1E293B] mb-6">個別回答ビューア</h2>

      {/* Tabs */}
      <div className="flex gap-4 mb-4">
        <button
          className={`text-sm px-4 py-2 rounded-lg transition-colors ${tab === "list" ? "bg-[#2563EB] text-white" : "bg-white text-[#64748B] border border-[#E2E8F0]"}`}
          onClick={() => setTab("list")}
        >
          回答一覧
        </button>
        <button
          className={`text-sm px-4 py-2 rounded-lg transition-colors ${tab === "freetext" ? "bg-[#2563EB] text-white" : "bg-white text-[#64748B] border border-[#E2E8F0]"}`}
          onClick={() => setTab("freetext")}
        >
          自由記入一覧
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={clinicFilter}
          onChange={(e) => setClinicFilter(e.target.value)}
          className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">全拠点</option>
          {CLINICS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {tab === "list" ? (
        <div className="flex gap-6">
          {/* Table */}
          <div className={`bg-white rounded-xl border border-[#E2E8F0] shadow-sm flex-1 overflow-hidden ${selectedId ? "max-w-[calc(100%-420px)]" : ""}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#FAFBFC] border-b border-[#E2E8F0]">
                    <th className="text-left px-4 py-3 text-[#64748B] font-medium">日時</th>
                    <th className="text-left px-4 py-3 text-[#64748B] font-medium">所属</th>
                    <th className="text-left px-4 py-3 text-[#64748B] font-medium">氏名</th>
                    <th className="text-left px-4 py-3 text-[#64748B] font-medium">平均</th>
                    <th className="text-left px-4 py-3 text-[#64748B] font-medium">最低</th>
                    <th className="text-center px-4 py-3 text-[#64748B] font-medium">💬</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b border-[#E2E8F0]/50 cursor-pointer hover:bg-[#EFF6FF]/50 transition-colors ${selectedId === r.id ? "bg-[#EFF6FF]" : ""}`}
                      onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                    >
                      <td className="px-4 py-2.5 text-[#64748B]">{r.timestamp || "-"}</td>
                      <td className="px-4 py-2.5 text-[#1E293B] truncate max-w-[150px]">{r.clinic}</td>
                      <td className="px-4 py-2.5 text-[#1E293B]">{r.name}</td>
                      <td className="px-4 py-2.5"><ScoreBadge score={r.avgScore} size="sm" /></td>
                      <td className="px-4 py-2.5 text-[#991B1B]">{r.lowestQuestion}: {r.lowestScore}</td>
                      <td className="px-4 py-2.5 text-center">{r.hasFreeText ? "💬" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side Panel */}
          {selectedId && detail && (
            <div className="w-[400px] flex-shrink-0 bg-white rounded-xl border border-[#E2E8F0] shadow-sm animate-slide-in overflow-y-auto max-h-[calc(100vh-200px)]">
              <div className="sticky top-0 bg-white border-b border-[#E2E8F0] px-5 py-4 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[#1E293B]">回答詳細</h4>
                <button onClick={() => setSelectedId(null)} className="text-[#64748B] hover:text-[#1E293B]">✕</button>
              </div>
              <div className="p-5">
                <div className="space-y-1 mb-4 text-xs text-[#64748B]">
                  <p>氏名: <span className="text-[#1E293B]">{detail.name}</span></p>
                  <p>所属: <span className="text-[#1E293B]">{detail.clinic}</span></p>
                  <p>日時: <span className="text-[#1E293B]">{detail.timestamp || "-"}</span></p>
                  <p>全体平均: <ScoreBadge score={detail.avgScore} size="sm" /></p>
                </div>

                {Object.entries(grouped).map(([area, questions]) => (
                  <div key={area} className="mb-4">
                    <AreaBadge area={area as AreaKey} />
                    <div className="mt-1 space-y-1">
                      {questions.map((q) => (
                        <div
                          key={q.id}
                          className={`flex items-center gap-2 py-1 px-2 rounded text-xs ${
                            q.diff != null && q.diff <= -1.0 ? "bg-[#FEE2E2]/30" : ""
                          }`}
                        >
                          <span className="text-[#64748B] w-7">Q{q.num}</span>
                          <span className="flex-1 text-[#1E293B] truncate">{q.shortLabel}</span>
                          <span className="font-[family-name:var(--font-inter)] font-bold w-5 text-center">
                            {q.value ?? "-"}
                          </span>
                          {q.diff != null && q.diff <= -2.0 && <span className="text-[#991B1B]">⬇️⬇️</span>}
                          {q.diff != null && q.diff <= -1.0 && q.diff > -2.0 && <span className="text-[#991B1B]">⬇️</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {detail.freeText && (
                  <div className="mt-4 border-t border-[#E2E8F0] pt-4">
                    <h5 className="text-xs font-medium text-[#64748B] mb-2">自由記入</h5>
                    <div className="border-l-[3px] border-[#2563EB] bg-[#FAFBFC] rounded-r-lg p-3">
                      <p className="text-xs text-[#1E293B] whitespace-pre-wrap">&ldquo;{detail.freeText}&rdquo;</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Free Text Tab */
        <div className="space-y-3">
          {freeTexts.length === 0 ? (
            <div className="text-center py-20 text-[#64748B]">自由記入回答がありません</div>
          ) : (
            freeTexts.map((ft) => (
              <div key={ft.id} className="border-l-[3px] border-[#2563EB] bg-white rounded-r-xl p-4 shadow-sm">
                <p className="text-sm text-[#1E293B] whitespace-pre-wrap mb-2">&ldquo;{ft.text}&rdquo;</p>
                <div className="flex items-center gap-3 text-[10px] text-[#64748B]">
                  <span>{ft.clinic}</span>
                  <span>{ft.name}</span>
                  <span>{ft.timestamp || ""}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
