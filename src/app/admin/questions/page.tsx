"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QUESTIONS } from "@/lib/questions";
import { getJigyotaiQuestions, type RespondentType } from "@/lib/jigyotai-questions";

interface ClinicQuestion {
  num: number;
  staff_text: string;
  director_text: string;
  area: string;
  area_label: string;
  question_key: string;
  compare_key: string | null;
}

interface JigyotaiQuestion {
  num: number;
  text: string;
  area: string;
  short_label: string;
  core_id: number | null;
  scale_type: "agreement" | "compensation";
  skip_options: string | null;
  question_key: string;
  compare_key: string | null;
}

const DEFAULT_AREAS = [
  { key: "safety", label: "心理的安全性" },
  { key: "director", label: "院長との関係性" },
  { key: "teamwork", label: "チームワーク" },
  { key: "growth", label: "働きがい・成長" },
  { key: "trust", label: "組織への信頼" },
];

const DEFAULT_CLINIC_KEYS = new Map(
  QUESTIONS.map((question) => [
    question.num,
    { question_key: question.questionKey, compare_key: question.compareKey },
  ])
);

function getDefaultClinicQuestionKey(num: number): string {
  return DEFAULT_CLINIC_KEYS.get(num)?.question_key ?? `clinic.custom.q${num}`;
}

function getDefaultClinicCompareKey(num: number, questionKey: string): string {
  return DEFAULT_CLINIC_KEYS.get(num)?.compare_key ?? questionKey;
}

function getDefaultJigyotaiQuestionKey(respondentType: RespondentType, num: number): string {
  return `jigyotai.${respondentType}.q${num}`;
}

function getDefaultJigyotaiCompareKey(
  respondentType: RespondentType,
  num: number,
  coreId: number | null
): string | null {
  if (respondentType === "staff") {
    return `jigyotai.core.${num}`;
  }
  if ((respondentType === "manager" || respondentType === "corporate") && coreId != null) {
    return `jigyotai.core.${coreId}`;
  }
  return null;
}

function QuestionsEditor() {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get("surveyId");
  const [surveyType, setSurveyType] = useState<"clinic" | "jigyotai" | null>(null);
  const [respondentType, setRespondentType] = useState<RespondentType>("staff");
  const [clinicQuestions, setClinicQuestions] = useState<ClinicQuestion[]>([]);
  const [jigyotaiQuestions, setJigyotaiQuestions] = useState<JigyotaiQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!surveyId) return;

    fetch(`/api/surveys/${surveyId}`)
      .then((r) => r.json())
      .then((survey) => {
        setSurveyType(survey.survey_type);
      });
  }, [surveyId]);

  useEffect(() => {
    if (!surveyId || !surveyType) return;

    const url = surveyType === "jigyotai"
      ? `/api/surveys/${surveyId}/questions?respondentType=${respondentType}`
      : `/api/surveys/${surveyId}/questions`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const questions = Array.isArray(data.questions) ? data.questions : [];
        if (surveyType === "clinic") {
          setClinicQuestions(questions.map((question: ClinicQuestion) => ({
            num: question.num,
            staff_text: question.staff_text,
            director_text: question.director_text,
            area: question.area,
            area_label: question.area_label,
            question_key: question.question_key || getDefaultClinicQuestionKey(question.num),
            compare_key: question.compare_key || getDefaultClinicCompareKey(question.num, question.question_key || getDefaultClinicQuestionKey(question.num)),
          })));
        } else {
          setJigyotaiQuestions(questions.map((question: JigyotaiQuestion) => ({
            num: question.num,
            text: question.text ?? "",
            area: question.area,
            short_label: question.short_label ?? "",
            core_id: question.core_id,
            scale_type: question.scale_type,
            skip_options: question.skip_options,
            question_key: question.question_key || getDefaultJigyotaiQuestionKey(respondentType, question.num),
            compare_key: question.compare_key || getDefaultJigyotaiCompareKey(respondentType, question.num, question.core_id),
          })));
        }
        setLoading(false);
      });
  }, [surveyId, surveyType, respondentType]);

  const loadDefaults = () => {
    if (surveyType === "clinic") {
      setClinicQuestions(QUESTIONS.map((question) => ({
        num: question.num,
        staff_text: question.staffText,
        director_text: question.directorText,
        area: question.area,
        area_label: question.areaLabel,
        question_key: question.questionKey,
        compare_key: question.compareKey,
      })));
      return;
    }

    setJigyotaiQuestions(getJigyotaiQuestions(respondentType).map((question) => ({
      num: question.id,
      text: question.text,
      area: question.area,
      short_label: question.short,
      core_id: question.coreId,
      scale_type: question.isCompensation ? "compensation" : "agreement",
      skip_options: question.skip,
      question_key: getDefaultJigyotaiQuestionKey(respondentType, question.id),
      compare_key: getDefaultJigyotaiCompareKey(respondentType, question.id, question.coreId),
    })));
  };

  const addQuestion = () => {
    if (surveyType === "clinic") {
      const nextNum = clinicQuestions.length > 0 ? Math.max(...clinicQuestions.map((question) => question.num)) + 1 : 1;
      setClinicQuestions([
        ...clinicQuestions,
        {
          num: nextNum,
          staff_text: "",
          director_text: "",
          area: "safety",
          area_label: "心理的安全性",
          question_key: getDefaultClinicQuestionKey(nextNum),
          compare_key: getDefaultClinicCompareKey(nextNum, getDefaultClinicQuestionKey(nextNum)),
        },
      ]);
      return;
    }

    const nextNum = jigyotaiQuestions.length > 0 ? Math.max(...jigyotaiQuestions.map((question) => question.num)) + 1 : 1;
    setJigyotaiQuestions([
      ...jigyotaiQuestions,
      {
        num: nextNum,
        text: "",
        area: "",
        short_label: "",
        core_id: null,
        scale_type: "agreement",
        skip_options: null,
        question_key: getDefaultJigyotaiQuestionKey(respondentType, nextNum),
        compare_key: getDefaultJigyotaiCompareKey(respondentType, nextNum, null),
      },
    ]);
  };

  const handleSave = async () => {
    if (!surveyId || !surveyType) return;
    setSaving(true);
    setSaved(false);

    const body = surveyType === "clinic"
      ? { questions: clinicQuestions }
      : { respondent_type: respondentType, questions: jigyotaiQuestions };

    await fetch(`/api/surveys/${surveyId}/questions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const removeClinicQuestion = (index: number) => {
    const updated = clinicQuestions.filter((_, questionIndex) => questionIndex !== index);
    setClinicQuestions(updated.map((question, questionIndex) => ({ ...question, num: questionIndex + 1 })));
  };

  const updateClinicQuestion = (index: number, field: keyof ClinicQuestion, value: string) => {
    const updated = [...clinicQuestions];
    if (field === "area") {
      const area = DEFAULT_AREAS.find((entry) => entry.key === value);
      updated[index] = { ...updated[index], area: value, area_label: area?.label || value };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setClinicQuestions(updated);
  };

  const removeJigyotaiQuestion = (index: number) => {
    const updated = jigyotaiQuestions.filter((_, questionIndex) => questionIndex !== index);
    setJigyotaiQuestions(updated.map((question, questionIndex) => ({ ...question, num: questionIndex + 1 })));
  };

  const updateJigyotaiQuestion = (
    index: number,
    field: keyof JigyotaiQuestion,
    value: string
  ) => {
    const updated = [...jigyotaiQuestions];
    if (field === "core_id") {
      updated[index] = { ...updated[index], core_id: value ? parseInt(value, 10) : null };
    } else if (field === "skip_options") {
      updated[index] = { ...updated[index], skip_options: value || null };
    } else if (field === "scale_type") {
      updated[index] = { ...updated[index], scale_type: value as JigyotaiQuestion["scale_type"] };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setJigyotaiQuestions(updated);
  };

  if (!surveyId) {
    return <div className="text-center py-20 text-[#6B7280]">管理画面からサーベイを選択してください</div>;
  }

  if (loading || !surveyType) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasQuestions = surveyType === "clinic" ? clinicQuestions.length > 0 : jigyotaiQuestions.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#111827]">質問テンプレート編集</h2>
          <p className="text-xs text-[#6B7280] mt-1">
            {surveyType === "clinic"
              ? "質問文と一緒に question_key / compare_key を管理します"
              : "回答者タイプごとに質問文と question_key / compare_key を管理します"}
          </p>
        </div>
        <div className="flex gap-3">
          {!hasQuestions && (
            <button
              onClick={loadDefaults}
              className="px-4 py-2 bg-[#F3F4F6] text-[#374151] rounded-xl text-sm font-medium hover:bg-[#E5E7EB] transition-colors"
            >
              デフォルト質問を読み込む
            </button>
          )}
          <button
            onClick={addQuestion}
            className="px-4 py-2 bg-white border border-[#D1D5DB] text-[#374151] rounded-xl text-sm font-medium hover:bg-[#F9FAFB] transition-colors"
          >
            + 質問追加
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasQuestions}
            className="px-6 py-2 bg-[#10B981] text-white rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors disabled:opacity-50"
          >
            {saving ? "保存中..." : saved ? "保存しました" : "保存"}
          </button>
        </div>
      </div>

      {surveyType === "jigyotai" && (
        <div className="flex gap-2 mb-6">
          {([
            { type: "staff" as const, label: "スタッフ" },
            { type: "manager" as const, label: "事業責任者/現場責任者" },
            { type: "corporate" as const, label: "経営企画室" },
          ]).map((entry) => (
            <button
              key={entry.type}
              onClick={() => {
                setLoading(true);
                setRespondentType(entry.type);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                respondentType === entry.type
                  ? "bg-[#10B981] text-white"
                  : "bg-white text-[#374151] border border-[#D1D5DB] hover:bg-[#F9FAFB]"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}

      {!hasQuestions ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center shadow-sm">
          <p className="text-[#6B7280] mb-4">質問が設定されていません</p>
          <button
            onClick={loadDefaults}
            className="px-6 py-2.5 bg-[#10B981] text-white rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors"
          >
            デフォルト質問セットを読み込む
          </button>
        </div>
      ) : surveyType === "clinic" ? (
        <div className="space-y-4">
          {clinicQuestions.map((question, index) => (
            <div key={index} className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[#10B981] bg-[#ECFDF5] px-3 py-1 rounded-lg">
                    Q{question.num}
                  </span>
                </div>
                <button
                  onClick={() => removeClinicQuestion(index)}
                  className="text-[#9CA3AF] hover:text-[#DC2626] transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="block text-xs text-[#6B7280] mb-1">領域</label>
                    <select
                      value={question.area}
                      onChange={(e) => updateClinicQuestion(index, "area", e.target.value)}
                      className="w-full text-sm border border-[#D1D5DB] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#10B981]/30"
                    >
                      {DEFAULT_AREAS.map((area) => (
                        <option key={area.key} value={area.key}>{area.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#6B7280] mb-1">question_key</label>
                    <input
                      type="text"
                      value={question.question_key}
                      onChange={(e) => updateClinicQuestion(index, "question_key", e.target.value)}
                      className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
                      placeholder="例: clinic.teamwork.share_information"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#6B7280] mb-1">compare_key</label>
                    <input
                      type="text"
                      value={question.compare_key ?? ""}
                      onChange={(e) => updateClinicQuestion(index, "compare_key", e.target.value)}
                      className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
                      placeholder="未入力なら question_key を使用"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">スタッフ向け質問文</label>
                  <textarea
                    value={question.staff_text}
                    onChange={(e) => updateClinicQuestion(index, "staff_text", e.target.value)}
                    rows={2}
                    className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981] resize-none"
                    placeholder="スタッフに表示する質問文"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">院長向け質問文</label>
                  <textarea
                    value={question.director_text}
                    onChange={(e) => updateClinicQuestion(index, "director_text", e.target.value)}
                    rows={2}
                    className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981] resize-none"
                    placeholder="院長に表示する質問文"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {jigyotaiQuestions.map((question, index) => (
            <div key={index} className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-[#10B981] bg-[#ECFDF5] px-3 py-1 rounded-lg">
                  Q{question.num}
                </span>
                <button
                  onClick={() => removeJigyotaiQuestion(index)}
                  className="text-[#9CA3AF] hover:text-[#DC2626] transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="grid gap-3 mb-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">領域</label>
                  <input
                    type="text"
                    value={question.area}
                    onChange={(e) => updateJigyotaiQuestion(index, "area", e.target.value)}
                    className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
                    placeholder="例: 心理的安全性"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">短縮ラベル</label>
                  <input
                    type="text"
                    value={question.short_label}
                    onChange={(e) => updateJigyotaiQuestion(index, "short_label", e.target.value)}
                    className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
                    placeholder="チャート表示用"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">question_key</label>
                  <input
                    type="text"
                    value={question.question_key}
                    onChange={(e) => updateJigyotaiQuestion(index, "question_key", e.target.value)}
                    className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
                    placeholder="例: jigyotai.staff.q3"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">compare_key</label>
                  <input
                    type="text"
                    value={question.compare_key ?? ""}
                    onChange={(e) => updateJigyotaiQuestion(index, "compare_key", e.target.value)}
                    className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
                    placeholder="例: jigyotai.core.3"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-xs text-[#6B7280] mb-1">質問文</label>
                <textarea
                  value={question.text}
                  onChange={(e) => updateJigyotaiQuestion(index, "text", e.target.value)}
                  rows={3}
                  className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981] resize-none"
                  placeholder="回答者に表示する質問文"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">core_id</label>
                  <input
                    type="number"
                    value={question.core_id ?? ""}
                    onChange={(e) => updateJigyotaiQuestion(index, "core_id", e.target.value)}
                    className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
                    placeholder="対応スタッフ質問番号"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">スケール</label>
                  <select
                    value={question.scale_type}
                    onChange={(e) => updateJigyotaiQuestion(index, "scale_type", e.target.value)}
                    className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
                  >
                    <option value="agreement">通常5段階</option>
                    <option value="compensation">報酬5段階</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">スキップ</label>
                  <input
                    type="text"
                    value={question.skip_options ?? ""}
                    onChange={(e) => updateJigyotaiQuestion(index, "skip_options", e.target.value)}
                    className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
                    placeholder="例: 1 / 2 / 13"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function QuestionsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><div className="animate-spin w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full" /></div>}>
      <QuestionsEditor />
    </Suspense>
  );
}
