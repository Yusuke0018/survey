"use client";

import { useEffect, useState } from "react";
import { ScoreBadge } from "@/components/score-badge";
import { CLINIC_GROUPS } from "@/lib/clinics";
import { ENTITY_GROUPS } from "@/lib/entities";
import { useSurveyContext } from "@/components/survey-context";

interface ResponseItem {
  key: string;
  respondentType: "staff" | "director" | "manager" | "corporate";
  respondentTypeLabel: string;
  orgUnit: string;
  orgUnitLabel: string;
  name: string;
  timestamp: string | null;
  avgScore: number;
  lowestQuestion: string | null;
  lowestScore: number | null;
  hasFreeText: boolean;
}

interface ResponseDetail {
  key: string;
  respondentType: "staff" | "director" | "manager" | "corporate";
  respondentTypeLabel: string;
  orgUnit: string;
  orgUnitLabel: string;
  name: string;
  timestamp: string | null;
  avgScore: number;
  freeText: string | null;
  questions: Array<{
    id: string;
    num: number;
    text: string;
    shortLabel: string;
    area: string;
    areaLabel: string;
    value: number | null;
    skipReason: string | null;
    benchmark: number | null;
    diff: number | null;
  }>;
}

interface FreeTextItem {
  key: string;
  respondentType: "staff" | "director" | "manager" | "corporate";
  respondentTypeLabel: string;
  orgUnit: string;
  orgUnitLabel: string;
  name: string;
  timestamp: string | null;
  text: string;
}

const CLINIC_TYPES = [
  { value: "", label: "全タイプ" },
  { value: "staff", label: "スタッフ" },
  { value: "director", label: "院長" },
];

const JIGYOTAI_TYPES = [
  { value: "", label: "全タイプ" },
  { value: "staff", label: "スタッフ" },
  { value: "manager", label: "事業責任者/現場責任者" },
  { value: "corporate", label: "経営企画室" },
];

export default function ResponsesPage() {
  const { id: surveyId, type: surveyType } = useSurveyContext();
  const isJigyotai = surveyType === "jigyotai";

  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [orgFilter, setOrgFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<ResponseDetail | null>(null);
  const [tab, setTab] = useState<"list" | "freetext">("list");
  const [freeTexts, setFreeTexts] = useState<FreeTextItem[]>([]);

  useEffect(() => {
    if (!surveyId) return;
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (orgFilter) params.set(isJigyotai ? "entity" : "clinic", orgFilter);
    const query = params.toString() ? `?${params.toString()}` : "";

    fetch(`/api/surveys/${surveyId}/responses${query}`).then((r) => r.json()).then(setResponses);
    fetch(`/api/surveys/${surveyId}/free-text${query}`).then((r) => r.json()).then(setFreeTexts);
  }, [surveyId, orgFilter, typeFilter, isJigyotai]);

  useEffect(() => {
    if (!surveyId || !selectedKey) return;
    fetch(`/api/surveys/${surveyId}/responses/${encodeURIComponent(selectedKey)}`)
      .then((r) => r.json())
      .then(setDetail);
  }, [surveyId, selectedKey]);

  if (!surveyId) {
    return <div className="text-center py-20 text-[#64748B]">サーベイを選択してください</div>;
  }

  const typeOptions = isJigyotai ? JIGYOTAI_TYPES : CLINIC_TYPES;
  const groupedQuestions = detail?.questions.reduce<Record<string, ResponseDetail["questions"]>>((acc, question) => {
    if (!acc[question.areaLabel]) {
      acc[question.areaLabel] = [];
    }
    acc[question.areaLabel].push(question);
    return acc;
  }, {}) || {};

  return (
    <div className="relative">
      <h2 className="text-2xl font-bold text-[#1E293B] mb-6">個別回答ビューア</h2>

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

      <div className="flex gap-4 mb-6 flex-wrap">
        <select
          value={typeFilter}
          onChange={(e) => {
            setSelectedKey(null);
            setDetail(null);
            setTypeFilter(e.target.value);
          }}
          className="border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#10B981]/30"
        >
          {typeOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select
          value={orgFilter}
          onChange={(e) => {
            setSelectedKey(null);
            setDetail(null);
            setOrgFilter(e.target.value);
          }}
          className="border border-[#E5E7EB] rounded-xl px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#10B981]/30"
        >
          <option value="">{isJigyotai ? "全事業体" : "全拠点"}</option>
          {isJigyotai
            ? ENTITY_GROUPS.map((group) => (
                <optgroup key={group.id} label={`${group.icon} ${group.label}`}>
                  {group.entities.map((entity) => (
                    <option key={entity} value={entity}>{entity}</option>
                  ))}
                </optgroup>
              ))
            : CLINIC_GROUPS.map((group) => (
                <optgroup key={group.id} label={`${group.icon} ${group.label}`}>
                  {group.clinics.map((clinic) => (
                    <option key={clinic} value={clinic}>{clinic}</option>
                  ))}
                </optgroup>
              ))}
        </select>
      </div>

      {tab === "list" ? (
        <div className="flex gap-6">
          <div className={`bg-white rounded-xl border border-[#E2E8F0] shadow-sm flex-1 overflow-hidden ${selectedKey ? "max-w-[calc(100%-440px)]" : ""}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#FAFBFC] border-b border-[#E2E8F0]">
                    <th className="text-left px-4 py-3 text-[#64748B] font-medium">日時</th>
                    <th className="text-left px-4 py-3 text-[#64748B] font-medium">回答者</th>
                    <th className="text-left px-4 py-3 text-[#64748B] font-medium">{isJigyotai ? "事業体" : "拠点"}</th>
                    <th className="text-left px-4 py-3 text-[#64748B] font-medium">氏名</th>
                    <th className="text-left px-4 py-3 text-[#64748B] font-medium">平均</th>
                    <th className="text-left px-4 py-3 text-[#64748B] font-medium">最低</th>
                    <th className="text-center px-4 py-3 text-[#64748B] font-medium">💬</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((response) => (
                    <tr
                      key={response.key}
                      className={`border-b border-[#E2E8F0]/50 cursor-pointer hover:bg-[#EFF6FF]/50 transition-colors ${selectedKey === response.key ? "bg-[#EFF6FF]" : ""}`}
                      onClick={() => setSelectedKey(response.key === selectedKey ? null : response.key)}
                    >
                      <td className="px-4 py-2.5 text-[#64748B]">{response.timestamp || "-"}</td>
                      <td className="px-4 py-2.5 text-[#1E293B]">{response.respondentTypeLabel}</td>
                      <td className="px-4 py-2.5 text-[#1E293B] truncate max-w-[180px]">{response.orgUnit}</td>
                      <td className="px-4 py-2.5 text-[#1E293B]">{response.name}</td>
                      <td className="px-4 py-2.5"><ScoreBadge score={response.avgScore} size="sm" /></td>
                      <td className="px-4 py-2.5 text-[#991B1B]">{response.lowestQuestion}: {response.lowestScore ?? "-"}</td>
                      <td className="px-4 py-2.5 text-center">{response.hasFreeText ? "💬" : ""}</td>
                    </tr>
                  ))}
                  {responses.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-[#64748B]">
                        条件に一致する回答がありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedKey && detail && (
            <div className="w-[420px] flex-shrink-0 bg-white rounded-xl border border-[#E2E8F0] shadow-sm animate-slide-in overflow-y-auto max-h-[calc(100vh-200px)]">
              <div className="sticky top-0 bg-white border-b border-[#E2E8F0] px-5 py-4 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[#1E293B]">回答詳細</h4>
                <button onClick={() => setSelectedKey(null)} className="text-[#64748B] hover:text-[#1E293B]">✕</button>
              </div>
              <div className="p-5">
                <div className="space-y-1 mb-4 text-xs text-[#64748B]">
                  <p>回答者: <span className="text-[#1E293B]">{detail.respondentTypeLabel}</span></p>
                  <p>{detail.orgUnitLabel}: <span className="text-[#1E293B]">{detail.orgUnit}</span></p>
                  <p>氏名: <span className="text-[#1E293B]">{detail.name}</span></p>
                  <p>日時: <span className="text-[#1E293B]">{detail.timestamp || "-"}</span></p>
                  <p>全体平均: <ScoreBadge score={detail.avgScore} size="sm" /></p>
                </div>

                {Object.entries(groupedQuestions).map(([area, questions]) => (
                  <div key={area} className="mb-4">
                    <div className="inline-flex items-center px-2 py-1 rounded-full bg-[#F1F5F9] text-[#334155] text-[11px] font-medium mb-2">
                      {area}
                    </div>
                    <div className="space-y-2">
                      {questions.map((question) => (
                        <div key={question.id} className="rounded-lg border border-[#E2E8F0] p-3">
                          <div className="flex items-center gap-2 mb-1 text-xs">
                            <span className="text-[#64748B]">Q{question.num}</span>
                            <span className="text-[#1E293B] font-medium">{question.shortLabel}</span>
                          </div>
                          <p className="text-[11px] text-[#64748B] mb-2">{question.text}</p>
                          <div className="flex items-center gap-3 text-xs text-[#475569]">
                            <span>回答: <strong>{question.value ?? "-"}</strong></span>
                            <span>同組織平均: <strong>{question.benchmark ?? "-"}</strong></span>
                            <span>差分: <strong>{question.diff ?? "-"}</strong></span>
                          </div>
                          {question.skipReason && (
                            <div className="mt-2 inline-flex px-2 py-1 rounded-full bg-[#F8FAFC] text-[#64748B] text-[11px]">
                              {question.skipReason}
                            </div>
                          )}
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
        <div className="space-y-3">
          {freeTexts.length === 0 ? (
            <div className="text-center py-20 text-[#64748B]">自由記入回答がありません</div>
          ) : (
            freeTexts.map((freeText) => (
              <div key={freeText.key} className="border-l-[3px] border-[#2563EB] bg-white rounded-r-xl p-4 shadow-sm">
                <p className="text-sm text-[#1E293B] whitespace-pre-wrap mb-2">&ldquo;{freeText.text}&rdquo;</p>
                <div className="flex items-center gap-3 text-[10px] text-[#64748B] flex-wrap">
                  <span>{freeText.respondentTypeLabel}</span>
                  <span>{freeText.orgUnit}</span>
                  <span>{freeText.name}</span>
                  <span>{freeText.timestamp || ""}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
