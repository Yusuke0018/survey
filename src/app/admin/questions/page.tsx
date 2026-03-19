"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
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

interface Survey {
  id: number;
  name: string;
  conducted_at: string;
  survey_type: string;
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

function ArrowUpIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
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

  // Phase 4: new state
  const [allSurveys, setAllSurveys] = useState<Survey[]>([]);
  const [questionKeySuggestions, setQuestionKeySuggestions] = useState<string[]>([]);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [originalClinicQuestions, setOriginalClinicQuestions] = useState<ClinicQuestion[]>([]);
  const [originalJigyotaiQuestions, setOriginalJigyotaiQuestions] = useState<JigyotaiQuestion[]>([]);

  // Load surveys list and question_key suggestions
  useEffect(() => {
    fetch("/api/surveys")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAllSurveys(data); });
    fetch("/api/surveys/question-keys")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setQuestionKeySuggestions(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!surveyId) return;

    fetch(`/api/surveys/${surveyId}`)
      .then((r) => r.json())
      .then((survey) => {
        setSurveyType(survey.survey_type);
      });
  }, [surveyId]);

  const loadQuestionsFromData = useCallback((questions: ClinicQuestion[] | JigyotaiQuestion[], type: "clinic" | "jigyotai") => {
    if (type === "clinic") {
      const mapped = (questions as ClinicQuestion[]).map((question: ClinicQuestion) => ({
        num: question.num,
        staff_text: question.staff_text,
        director_text: question.director_text,
        area: question.area,
        area_label: question.area_label,
        question_key: question.question_key || getDefaultClinicQuestionKey(question.num),
        compare_key: question.compare_key || getDefaultClinicCompareKey(question.num, question.question_key || getDefaultClinicQuestionKey(question.num)),
      }));
      setClinicQuestions(mapped);
      setOriginalClinicQuestions(mapped);
    } else {
      const mapped = (questions as JigyotaiQuestion[]).map((question: JigyotaiQuestion) => ({
        num: question.num,
        text: question.text ?? "",
        area: question.area,
        short_label: question.short_label ?? "",
        core_id: question.core_id,
        scale_type: question.scale_type,
        skip_options: question.skip_options,
        question_key: question.question_key || getDefaultJigyotaiQuestionKey(respondentType, question.num),
        compare_key: question.compare_key || getDefaultJigyotaiCompareKey(respondentType, question.num, question.core_id),
      }));
      setJigyotaiQuestions(mapped);
      setOriginalJigyotaiQuestions(mapped);
    }
  }, [respondentType]);

  useEffect(() => {
    if (!surveyId || !surveyType) return;

    const url = surveyType === "jigyotai"
      ? `/api/surveys/${surveyId}/questions?respondentType=${respondentType}`
      : `/api/surveys/${surveyId}/questions`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const questions = Array.isArray(data.questions) ? data.questions : [];
        loadQuestionsFromData(questions, surveyType);
        setLoading(false);
      });
  }, [surveyId, surveyType, respondentType, loadQuestionsFromData]);

  const loadDefaults = () => {
    if (surveyType === "clinic") {
      const defaults = QUESTIONS.map((question) => ({
        num: question.num,
        staff_text: question.staffText,
        director_text: question.directorText,
        area: question.area,
        area_label: question.areaLabel,
        question_key: question.questionKey,
        compare_key: question.compareKey,
      }));
      setClinicQuestions(defaults);
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

  // Copy from another survey
  const copyFromSurvey = async (fromSurveyId: number) => {
    setCopyLoading(true);
    try {
      const url = surveyType === "jigyotai"
        ? `/api/surveys/${fromSurveyId}/questions?respondentType=${respondentType}`
        : `/api/surveys/${fromSurveyId}/questions`;

      const res = await fetch(url);
      const data = await res.json();
      const questions = Array.isArray(data.questions) ? data.questions : [];

      if (surveyType === "clinic") {
        setClinicQuestions(questions.map((q: ClinicQuestion, i: number) => ({
          num: i + 1,
          staff_text: q.staff_text,
          director_text: q.director_text,
          area: q.area,
          area_label: q.area_label,
          question_key: q.question_key || getDefaultClinicQuestionKey(i + 1),
          compare_key: q.compare_key || getDefaultClinicCompareKey(i + 1, q.question_key || getDefaultClinicQuestionKey(i + 1)),
        })));
      } else {
        setJigyotaiQuestions(questions.map((q: JigyotaiQuestion, i: number) => ({
          num: i + 1,
          text: q.text ?? "",
          area: q.area,
          short_label: q.short_label ?? "",
          core_id: q.core_id,
          scale_type: q.scale_type,
          skip_options: q.skip_options,
          question_key: q.question_key || getDefaultJigyotaiQuestionKey(respondentType, i + 1),
          compare_key: q.compare_key || getDefaultJigyotaiCompareKey(respondentType, i + 1, q.core_id),
        })));
      }
    } finally {
      setCopyLoading(false);
      setShowCopyModal(false);
    }
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

    // Update originals after save
    if (surveyType === "clinic") {
      setOriginalClinicQuestions([...clinicQuestions]);
    } else {
      setOriginalJigyotaiQuestions([...jigyotaiQuestions]);
    }

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

  const moveClinicQuestion = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === clinicQuestions.length - 1) return;
    const updated = [...clinicQuestions];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    [updated[index], updated[swapIdx]] = [updated[swapIdx], updated[index]];
    setClinicQuestions(updated.map((q, i) => ({ ...q, num: i + 1 })));
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

  const moveJigyotaiQuestion = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === jigyotaiQuestions.length - 1) return;
    const updated = [...jigyotaiQuestions];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    [updated[index], updated[swapIdx]] = [updated[swapIdx], updated[index]];
    setJigyotaiQuestions(updated.map((q, i) => ({ ...q, num: i + 1 })));
  };

  // Change preview computation
  const clinicDiff = computeClinicDiff(originalClinicQuestions, clinicQuestions);
  const jigyotaiDiff = computeJigyotaiDiff(originalJigyotaiQuestions, jigyotaiQuestions);
  const hasChanges = surveyType === "clinic"
    ? clinicDiff.added > 0 || clinicDiff.removed > 0 || clinicDiff.modified > 0 || clinicDiff.reordered
    : jigyotaiDiff.added > 0 || jigyotaiDiff.removed > 0 || jigyotaiDiff.modified > 0 || jigyotaiDiff.reordered;

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
  const otherSurveys = allSurveys.filter((s) => String(s.id) !== surveyId && s.survey_type === surveyType);

  return (
    <div>
      {/* datalist for question_key suggestions */}
      <datalist id="question-key-suggestions">
        {questionKeySuggestions.map((key) => (
          <option key={key} value={key} />
        ))}
      </datalist>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#111827]">質問テンプレート編集</h2>
          <p className="text-xs text-[#6B7280] mt-1">
            {surveyType === "clinic"
              ? "質問文と一緒に question_key / compare_key を管理します"
              : "回答者タイプごとに質問文と question_key / compare_key を管理します"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {!hasQuestions && (
            <button
              onClick={loadDefaults}
              className="px-4 py-2 bg-[#F3F4F6] text-[#374151] rounded-xl text-sm font-medium hover:bg-[#E5E7EB] transition-colors"
            >
              デフォルト質問を読み込む
            </button>
          )}
          {otherSurveys.length > 0 && (
            <button
              onClick={() => setShowCopyModal(true)}
              className="px-4 py-2 bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] rounded-xl text-sm font-medium hover:bg-[#DBEAFE] transition-colors"
            >
              前回サーベイから複製
            </button>
          )}
          <button
            onClick={addQuestion}
            className="px-4 py-2 bg-white border border-[#D1D5DB] text-[#374151] rounded-xl text-sm font-medium hover:bg-[#F9FAFB] transition-colors"
          >
            + 質問追加
          </button>
          {hasChanges && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                showPreview
                  ? "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                  : "bg-white text-[#92400E] border border-[#FDE68A] hover:bg-[#FEF3C7]"
              }`}
            >
              {showPreview ? "プレビューを閉じる" : "変更プレビュー"}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasQuestions}
            className="px-6 py-2 bg-[#10B981] text-white rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors disabled:opacity-50"
          >
            {saving ? "保存中..." : saved ? "保存しました" : "保存"}
          </button>
        </div>
      </div>

      {/* Copy from survey modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCopyModal(false)}>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#111827] mb-2">前回サーベイから複製</h3>
            <p className="text-xs text-[#6B7280] mb-4">選択したサーベイの質問テンプレートを読み込みます。現在の質問は上書きされます。</p>
            {copyLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {otherSurveys.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => copyFromSurvey(s.id)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-[#E5E7EB] hover:border-[#10B981] hover:bg-[#ECFDF5] transition-colors"
                  >
                    <p className="text-sm font-medium text-[#111827]">{s.name}</p>
                    <p className="text-xs text-[#6B7280]">{s.conducted_at}</p>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowCopyModal(false)}
              className="mt-4 w-full px-4 py-2 bg-[#F3F4F6] text-[#374151] rounded-xl text-sm font-medium hover:bg-[#E5E7EB] transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Change preview */}
      {showPreview && hasChanges && (
        <div className="mb-6 bg-[#FFFBEB] rounded-xl border border-[#FDE68A] p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#92400E] mb-3">変更プレビュー</h3>
          {surveyType === "clinic" ? (
            <ClinicDiffView diff={clinicDiff} />
          ) : (
            <JigyotaiDiffView diff={jigyotaiDiff} />
          )}
        </div>
      )}

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
          <div className="flex gap-3 justify-center">
            <button
              onClick={loadDefaults}
              className="px-6 py-2.5 bg-[#10B981] text-white rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors"
            >
              デフォルト質問セットを読み込む
            </button>
            {otherSurveys.length > 0 && (
              <button
                onClick={() => setShowCopyModal(true)}
                className="px-6 py-2.5 bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] rounded-xl text-sm font-semibold hover:bg-[#DBEAFE] transition-colors"
              >
                前回サーベイから複製
              </button>
            )}
          </div>
        </div>
      ) : surveyType === "clinic" ? (
        <div className="space-y-4">
          {clinicQuestions.map((question, index) => (
            <div key={index} className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveClinicQuestion(index, "up")}
                      disabled={index === 0}
                      className="text-[#9CA3AF] hover:text-[#374151] disabled:opacity-30 transition-colors"
                    >
                      <ArrowUpIcon />
                    </button>
                    <button
                      onClick={() => moveClinicQuestion(index, "down")}
                      disabled={index === clinicQuestions.length - 1}
                      className="text-[#9CA3AF] hover:text-[#374151] disabled:opacity-30 transition-colors"
                    >
                      <ArrowDownIcon />
                    </button>
                  </div>
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
                      list="question-key-suggestions"
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
                      list="question-key-suggestions"
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
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveJigyotaiQuestion(index, "up")}
                      disabled={index === 0}
                      className="text-[#9CA3AF] hover:text-[#374151] disabled:opacity-30 transition-colors"
                    >
                      <ArrowUpIcon />
                    </button>
                    <button
                      onClick={() => moveJigyotaiQuestion(index, "down")}
                      disabled={index === jigyotaiQuestions.length - 1}
                      className="text-[#9CA3AF] hover:text-[#374151] disabled:opacity-30 transition-colors"
                    >
                      <ArrowDownIcon />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-[#10B981] bg-[#ECFDF5] px-3 py-1 rounded-lg">
                    Q{question.num}
                  </span>
                </div>
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
                    list="question-key-suggestions"
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
                    list="question-key-suggestions"
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

// --- Diff computation and preview components ---

interface DiffResult {
  added: number;
  removed: number;
  modified: number;
  reordered: boolean;
  details: Array<{
    type: "added" | "removed" | "modified" | "unchanged";
    num: number;
    questionKey: string;
    changes?: string[];
  }>;
}

function computeClinicDiff(original: ClinicQuestion[], current: ClinicQuestion[]): DiffResult {
  const origMap = new Map(original.map((q) => [q.question_key, q]));
  const currMap = new Map(current.map((q) => [q.question_key, q]));
  const details: DiffResult["details"] = [];
  let added = 0, removed = 0, modified = 0, reordered = false;

  for (const q of current) {
    const orig = origMap.get(q.question_key);
    if (!orig) {
      added++;
      details.push({ type: "added", num: q.num, questionKey: q.question_key });
    } else {
      const changes: string[] = [];
      if (orig.staff_text !== q.staff_text) changes.push("スタッフ質問文");
      if (orig.director_text !== q.director_text) changes.push("院長質問文");
      if (orig.area !== q.area) changes.push("領域");
      if (orig.compare_key !== q.compare_key) changes.push("compare_key");
      if (orig.num !== q.num) reordered = true;
      if (changes.length > 0) {
        modified++;
        details.push({ type: "modified", num: q.num, questionKey: q.question_key, changes });
      } else {
        details.push({ type: "unchanged", num: q.num, questionKey: q.question_key });
      }
    }
  }

  for (const q of original) {
    if (!currMap.has(q.question_key)) {
      removed++;
      details.push({ type: "removed", num: q.num, questionKey: q.question_key });
    }
  }

  return { added, removed, modified, reordered, details };
}

function computeJigyotaiDiff(original: JigyotaiQuestion[], current: JigyotaiQuestion[]): DiffResult {
  const origMap = new Map(original.map((q) => [q.question_key, q]));
  const currMap = new Map(current.map((q) => [q.question_key, q]));
  const details: DiffResult["details"] = [];
  let added = 0, removed = 0, modified = 0, reordered = false;

  for (const q of current) {
    const orig = origMap.get(q.question_key);
    if (!orig) {
      added++;
      details.push({ type: "added", num: q.num, questionKey: q.question_key });
    } else {
      const changes: string[] = [];
      if (orig.text !== q.text) changes.push("質問文");
      if (orig.area !== q.area) changes.push("領域");
      if (orig.short_label !== q.short_label) changes.push("短縮ラベル");
      if (orig.compare_key !== q.compare_key) changes.push("compare_key");
      if (orig.num !== q.num) reordered = true;
      if (changes.length > 0) {
        modified++;
        details.push({ type: "modified", num: q.num, questionKey: q.question_key, changes });
      } else {
        details.push({ type: "unchanged", num: q.num, questionKey: q.question_key });
      }
    }
  }

  for (const q of original) {
    if (!currMap.has(q.question_key)) {
      removed++;
      details.push({ type: "removed", num: q.num, questionKey: q.question_key });
    }
  }

  return { added, removed, modified, reordered, details };
}

function DiffSummaryBadges({ diff }: { diff: DiffResult }) {
  return (
    <div className="flex gap-2 mb-3 flex-wrap">
      {diff.added > 0 && (
        <span className="text-xs px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#166534] font-medium">
          +{diff.added} 追加
        </span>
      )}
      {diff.removed > 0 && (
        <span className="text-xs px-2.5 py-1 rounded-full bg-[#FEE2E2] text-[#991B1B] font-medium">
          -{diff.removed} 削除
        </span>
      )}
      {diff.modified > 0 && (
        <span className="text-xs px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] font-medium">
          {diff.modified} 変更
        </span>
      )}
      {diff.reordered && (
        <span className="text-xs px-2.5 py-1 rounded-full bg-[#E0E7FF] text-[#3730A3] font-medium">
          並び替えあり
        </span>
      )}
    </div>
  );
}

function DiffDetailList({ diff }: { diff: DiffResult }) {
  const changed = diff.details.filter((d) => d.type !== "unchanged");
  if (changed.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {changed.map((d, i) => (
        <div key={i} className={`text-xs px-3 py-2 rounded-lg ${
          d.type === "added" ? "bg-[#F0FDF4] text-[#166534]" :
          d.type === "removed" ? "bg-[#FEF2F2] text-[#991B1B]" :
          "bg-[#FFFBEB] text-[#92400E]"
        }`}>
          <span className="font-medium">
            Q{d.num}
          </span>
          <span className="ml-2 font-mono text-[10px] opacity-70">{d.questionKey}</span>
          {d.type === "added" && <span className="ml-2">新規追加</span>}
          {d.type === "removed" && <span className="ml-2">削除</span>}
          {d.type === "modified" && d.changes && (
            <span className="ml-2">{d.changes.join("、")} を変更</span>
          )}
        </div>
      ))}
    </div>
  );
}

function ClinicDiffView({ diff }: { diff: DiffResult }) {
  return (
    <div>
      <DiffSummaryBadges diff={diff} />
      <DiffDetailList diff={diff} />
    </div>
  );
}

function JigyotaiDiffView({ diff }: { diff: DiffResult }) {
  return (
    <div>
      <DiffSummaryBadges diff={diff} />
      <DiffDetailList diff={diff} />
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
