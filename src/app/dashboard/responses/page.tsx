"use client";

import { useEffect, useMemo, useState } from "react";
import { ScoreBadge, getScoreBorderColor, getScoreColor, getScoreTextColor } from "@/components/score-badge";
import { CLINIC_GROUPS } from "@/lib/clinics";
import { ENTITY_GROUPS } from "@/lib/entities";
import { useSurveyContext } from "@/components/survey-context";
import { fetchJsonSafe } from "@/lib/client-json";

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
  freeText: string | null;
  answers: Array<{
    num: number;
    value: number | null;
    skipReason: string | null;
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

function getAnswerCellStyle(value: number | null) {
  return {
    backgroundColor: getScoreColor(value),
    color: getScoreTextColor(value),
    borderColor: getScoreBorderColor(value),
  };
}

function getAnswerLabel(value: number | null, skipReason: string | null) {
  if (skipReason) return "SKIP";
  if (value == null) return "-";
  return String(value);
}

export default function ResponsesPage() {
  const { id: surveyId, type: surveyType } = useSurveyContext();
  const isJigyotai = surveyType === "jigyotai";

  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [orgFilter, setOrgFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [tab, setTab] = useState<"list" | "freetext">("list");
  const [freeTexts, setFreeTexts] = useState<FreeTextItem[]>([]);

  useEffect(() => {
    if (!surveyId) return;
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (orgFilter) params.set(isJigyotai ? "entity" : "clinic", orgFilter);
    const query = params.toString() ? `?${params.toString()}` : "";

    fetchJsonSafe(`/api/surveys/${surveyId}/responses${query}`, Array.isArray, [] as ResponseItem[]).then(setResponses);
    fetchJsonSafe(`/api/surveys/${surveyId}/free-text${query}`, Array.isArray, [] as FreeTextItem[]).then(setFreeTexts);
  }, [surveyId, orgFilter, typeFilter, isJigyotai]);

  const questionNumbers = useMemo(
    () => [...new Set(responses.flatMap((response) => response.answers.map((answer) => answer.num)))].sort((a, b) => a - b),
    [responses]
  );

  if (!surveyId) {
    return <div className="py-20 text-center text-[#64748B]">サーベイを選択してください</div>;
  }

  const typeOptions = isJigyotai ? JIGYOTAI_TYPES : CLINIC_TYPES;

  return (
    <div className="relative">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1E293B]">個別回答ビューア</h2>
          <p className="mt-2 text-sm text-[#64748B]">
            平均だけではなく、各回答の Q1 から自由記入まで横並びで確認できます。横スクロールで全設問を見られます。
          </p>
        </div>
        <div className="rounded-2xl border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-3 text-xs text-[#1D4ED8]">
          ぱっと見で弱い項目を拾えるように、低得点は赤、高得点は緑で表示しています。
        </div>
      </div>

      <div className="mb-4 flex gap-4">
        <button
          className={`rounded-lg px-4 py-2 text-sm transition-colors ${tab === "list" ? "bg-[#2563EB] text-white" : "border border-[#E2E8F0] bg-white text-[#64748B]"}`}
          onClick={() => setTab("list")}
        >
          回答一覧
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm transition-colors ${tab === "freetext" ? "bg-[#2563EB] text-white" : "border border-[#E2E8F0] bg-white text-[#64748B]"}`}
          onClick={() => setTab("freetext")}
        >
          自由記入一覧
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30"
        >
          {typeOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30"
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
        <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
          <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs text-[#64748B]">
            表示件数: <span className="font-semibold text-[#0F172A]">{responses.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr className="bg-[#0F172A] text-white">
                  <th className="sticky left-0 z-20 min-w-[108px] border-b border-[#1E293B] bg-[#0F172A] px-3 py-2 text-left font-semibold">日時</th>
                  <th className="sticky left-[108px] z-20 min-w-[88px] border-b border-[#1E293B] bg-[#0F172A] px-3 py-2 text-left font-semibold">{isJigyotai ? "回答者" : "区分"}</th>
                  <th className="sticky left-[196px] z-20 min-w-[160px] border-b border-[#1E293B] bg-[#0F172A] px-3 py-2 text-left font-semibold">{isJigyotai ? "事業体" : "拠点"}</th>
                  <th className="sticky left-[356px] z-20 min-w-[120px] border-b border-[#1E293B] bg-[#0F172A] px-3 py-2 text-left font-semibold">氏名</th>
                  <th className="sticky left-[476px] z-20 min-w-[84px] border-b border-[#1E293B] bg-[#0F172A] px-3 py-2 text-left font-semibold">平均</th>
                  {questionNumbers.map((num) => (
                    <th key={num} className="min-w-[56px] border-b border-[#1E293B] px-2 py-2 text-center font-semibold">
                      Q{num}
                    </th>
                  ))}
                  <th className="min-w-[320px] border-b border-[#1E293B] px-3 py-2 text-left font-semibold">自由記入</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((response, index) => {
                  const answerMap = new Map(response.answers.map((answer) => [answer.num, answer]));
                  return (
                    <tr key={response.key} className={index % 2 === 0 ? "bg-white" : "bg-[#FBFDFF]"}>
                      <td className="sticky left-0 z-10 border-b border-[#E2E8F0] bg-inherit px-3 py-2 text-[#475569]">
                        {response.timestamp || "-"}
                      </td>
                      <td className="sticky left-[108px] z-10 border-b border-[#E2E8F0] bg-inherit px-3 py-2 text-[#0F172A]">
                        {response.respondentTypeLabel}
                      </td>
                      <td className="sticky left-[196px] z-10 max-w-[160px] truncate border-b border-[#E2E8F0] bg-inherit px-3 py-2 text-[#0F172A]">
                        {response.orgUnit}
                      </td>
                      <td className="sticky left-[356px] z-10 border-b border-[#E2E8F0] bg-inherit px-3 py-2 text-[#0F172A]">
                        {response.name}
                      </td>
                      <td className="sticky left-[476px] z-10 border-b border-[#E2E8F0] bg-inherit px-3 py-2">
                        <ScoreBadge score={response.avgScore} size="sm" />
                      </td>
                      {questionNumbers.map((num) => {
                        const answer = answerMap.get(num);
                        const cellValue = answer?.value ?? null;
                        return (
                          <td key={num} className="border-b border-[#E2E8F0] px-1.5 py-2 text-center">
                            <div
                              className="mx-auto flex h-8 w-10 items-center justify-center rounded-md border text-[11px] font-bold"
                              style={getAnswerCellStyle(answer?.skipReason ? null : cellValue)}
                              title={answer?.skipReason || (cellValue != null ? `Q${num}: ${cellValue}` : `Q${num}: 未回答`)}
                            >
                              {getAnswerLabel(cellValue, answer?.skipReason || null)}
                            </div>
                          </td>
                        );
                      })}
                      <td className="max-w-[320px] border-b border-[#E2E8F0] px-3 py-2 text-[#334155]">
                        <div className={`line-clamp-3 ${response.hasFreeText ? "" : "text-[#94A3B8]"}`}>
                          {response.freeText?.trim() || "-"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {responses.length === 0 && (
                  <tr>
                    <td colSpan={6 + questionNumbers.length} className="px-4 py-12 text-center text-[#64748B]">
                      条件に一致する回答がありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {freeTexts.length === 0 ? (
            <div className="py-20 text-center text-[#64748B]">自由記入回答がありません</div>
          ) : (
            freeTexts.map((freeText) => (
              <div key={freeText.key} className="rounded-r-xl border-l-[3px] border-[#2563EB] bg-white p-4 shadow-sm">
                <p className="mb-2 whitespace-pre-wrap text-sm text-[#1E293B]">&ldquo;{freeText.text}&rdquo;</p>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#64748B]">
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
