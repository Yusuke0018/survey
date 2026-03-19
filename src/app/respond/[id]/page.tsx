"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CLINIC_GROUPS } from "@/lib/clinics";
import { ENTITY_GROUPS } from "@/lib/entities";

interface Question {
  id: number;
  num: number;
  staff_text: string;
  director_text: string;
  text: string | null;
  area: string;
  area_label: string;
  respondent_type: string | null;
  short_label: string | null;
  scale_type: string;
  skip_options: string | null;
}

interface SurveyMeta {
  survey_type: string;
}

interface AuthMe {
  provider: "admin" | "google" | null;
  user: {
    email: string;
    name: string | null;
  } | null;
}

type RespondentType = "staff" | "director" | "manager" | "corporate";

const SKIP_LABELS: Record<string, string> = {
  "1": "関わりがないため回答できない",
  "2": "経営企画室が兼任のためスキップ",
  "3": "責任者と同一のためスキップ",
};

const COMPENSATION_CHOICES = [
  { value: 5, label: "十分に適正である" },
  { value: 4, label: "概ね適正である" },
  { value: 3, label: "どちらとも言えない" },
  { value: 2, label: "やや見直しが必要と感じる" },
  { value: 1, label: "改善が必要と感じる" },
];

export default function RespondSurveyPage() {
  const params = useParams();
  const surveyId = params.id as string;
  const [surveyMeta, setSurveyMeta] = useState<SurveyMeta | null>(null);
  const [authMe, setAuthMe] = useState<AuthMe | null>(null);
  const [respondentType, setRespondentType] = useState<RespondentType>("staff");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [orgUnit, setOrgUnit] = useState("");
  const [respondentName, setRespondentName] = useState("");
  const [answers, setAnswers] = useState<Record<number, number | null>>({});
  const [skips, setSkips] = useState<Record<number, string>>({});
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/surveys/${surveyId}/questions`)
      .then((r) => r.json())
      .then((data) => {
        setSurveyMeta({ survey_type: data.survey_type });
        if (data.survey_type !== "jigyotai" && Array.isArray(data.questions)) {
          setQuestions(data.questions);
        }
      });

    fetch("/api/auth/me")
      .then((response) => response.json())
      .then(setAuthMe)
      .catch(() => setAuthMe(null));
  }, [surveyId]);

  useEffect(() => {
    if (!surveyMeta) return;
    const url = surveyMeta.survey_type === "jigyotai"
      ? `/api/surveys/${surveyId}/questions?respondentType=${respondentType}`
      : `/api/surveys/${surveyId}/questions`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setQuestions(Array.isArray(data.questions) ? data.questions : []);
        setLoading(false);
      });
  }, [surveyId, respondentType, surveyMeta]);

  const isJigyotai = surveyMeta?.survey_type === "jigyotai";

  const getSessionToken = (): string => {
    const key = `survey_session_${surveyId}_${respondentType}`;
    let token = localStorage.getItem(key);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(key, token);
    }
    return token;
  };

  const handleAnswer = (questionId: number, score: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));
    setSkips((prev) => { const n = { ...prev }; delete n[questionId]; return n; });
  };

  const handleSkip = (questionId: number, skipKey: string) => {
    setSkips((prev) => ({ ...prev, [questionId]: SKIP_LABELS[skipKey] || skipKey }));
    setAnswers((prev) => ({ ...prev, [questionId]: null }));
  };

  const handleRespondentTypeChange = (nextType: RespondentType) => {
    setLoading(true);
    setRespondentType(nextType);
    setAnswers({});
    setSkips({});
    setFreeText("");
    setSubmitted(false);
    setError("");
  };

  const isAnswered = (q: Question) => answers[q.id] !== undefined || skips[q.id];

  const handleSubmit = async () => {
    if (!orgUnit) {
      setError(isJigyotai ? "事業体を選択してください" : "拠点を選択してください");
      return;
    }
    const unanswered = questions.filter((q) => !isAnswered(q));
    if (unanswered.length > 0) {
      setError(`未回答の質問があります（Q${unanswered.map(q => q.num).join(", Q")}）`);
      return;
    }

    setSubmitting(true);
    setError("");

    const body: Record<string, unknown> = {
      respondentType,
      respondentName: respondentName || undefined,
      freeText: freeText || undefined,
      sessionToken: getSessionToken(),
      answers: questions.map((q) => ({
        questionId: q.id,
        score: answers[q.id] ?? null,
        skipReason: skips[q.id] || null,
      })),
    };

    if (isJigyotai) {
      body.entity = orgUnit;
    } else {
      body.clinic = orgUnit;
    }

    const res = await fetch(`/api/surveys/${surveyId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setSubmitted(true);
    } else {
      const data = await res.json();
      setError(data.error || "送信に失敗しました");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-[#ECFDF5] rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-[#111827] mb-2">回答を送信しました</h2>
        <p className="text-sm text-[#6B7280]">ご協力ありがとうございました</p>
        {authMe?.provider === "google" && (
          <Link
            href="/respond/history"
            className="mt-4 inline-flex rounded-xl border border-[#D1D5DB] px-5 py-2.5 text-sm font-semibold text-[#111827] hover:bg-[#F8FAFC]"
          >
            マイ回答を見る
          </Link>
        )}
        {isJigyotai && respondentType === "corporate" && (
          <button
            onClick={() => { setSubmitted(false); setOrgUnit(""); setAnswers({}); setSkips({}); setFreeText(""); }}
            className="mt-4 ml-3 px-6 py-2.5 bg-[#10B981] text-white rounded-xl text-sm font-semibold hover:bg-[#059669]"
          >
            別の事業体について回答する
          </button>
        )}
      </div>
    );
  }

  if (questions.length === 0 && !isJigyotai) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center shadow-sm">
        <p className="text-[#6B7280]">このサーベイには質問が設定されていません</p>
      </div>
    );
  }

  // Group by area
  const grouped: Record<string, Question[]> = {};
  for (const q of questions) {
    const key = q.area;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(q);
  }

  const answeredCount = questions.filter((q) => isAnswered(q)).length;
  const total = questions.length;
  const allAnswered = answeredCount === total && total > 0;

  const getQuestionText = (q: Question) => {
    if (!isJigyotai && respondentType === "director") {
      return q.director_text || q.staff_text;
    }
    return q.text || q.staff_text;
  };
  const getSkipKeys = (q: Question): string[] => {
    if (!q.skip_options) return [];
    return q.skip_options.split("").filter(k => k !== "0");
  };

  return (
    <div>
      {authMe?.provider === "google" && (
        <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-xl p-4 shadow-sm mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#1D4ED8]">
                {authMe.user?.name || authMe.user?.email} としてログイン中
              </p>
              <p className="mt-1 text-xs text-[#475569]">
                回答は Google アカウントに紐づいて保存されます。氏名欄を空欄にしても、本人だけはマイ回答から見返せます。
              </p>
            </div>
            <Link href="/respond/history" className="shrink-0 text-sm font-semibold text-[#2563EB] hover:underline">
              マイ回答
            </Link>
          </div>
        </div>
      )}

      {/* Respondent Type Selector */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm mb-6">
        <label className="block text-sm font-medium text-[#374151] mb-3">回答者タイプ</label>
        <div className="flex gap-2">
          {(isJigyotai
            ? [
                { type: "staff" as const, label: "スタッフ", icon: "👤" },
                { type: "manager" as const, label: "事業責任者/現場責任者", icon: "👔" },
                { type: "corporate" as const, label: "経営企画室", icon: "🏛️" },
              ]
            : [
                { type: "staff" as const, label: "スタッフ", icon: "👤" },
                { type: "director" as const, label: "院長", icon: "🩺" },
              ]).map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => handleRespondentTypeChange(type)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                respondentType === type
                  ? "bg-[#10B981] text-white shadow-sm"
                  : "bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6]"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      {isJigyotai && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm mb-6">
          <p className="text-xs text-[#6B7280]">
            経営企画室は事業体ごとに回答できます。その他の回答者タイプはサーベイごとに1回です。
          </p>
        </div>
      )}

      {/* Progress */}
      {total > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#374151]">回答進捗</span>
            <span className="text-sm text-[#6B7280]">{answeredCount} / {total}</span>
          </div>
          <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#10B981] rounded-full transition-all duration-300"
              style={{ width: `${total > 0 ? (answeredCount / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Organization & Name */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              {isJigyotai ? "事業体" : "所属拠点"} <span className="text-[#DC2626]">*</span>
            </label>
            <select
              value={orgUnit}
              onChange={(e) => setOrgUnit(e.target.value)}
              className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981] bg-white"
            >
              <option value="">選択してください</option>
              {isJigyotai
                ? ENTITY_GROUPS.map((group) => (
                    <optgroup key={group.id} label={`${group.icon} ${group.label}`}>
                      {group.entities.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </optgroup>
                  ))
                : CLINIC_GROUPS.map((group) => (
                    <optgroup key={group.id} label={`${group.icon} ${group.label}`}>
                      {group.clinics.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  ))
              }
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              氏名 <span className="text-[#9CA3AF]">(任意)</span>
            </label>
            <input
              type="text"
              value={respondentName}
              onChange={(e) => setRespondentName(e.target.value)}
              className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
              placeholder="匿名でも回答できます"
            />
          </div>
        </div>
      </div>

      {/* Questions */}
      {total === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center shadow-sm mb-6">
          <p className="text-[#6B7280]">この回答者タイプの質問が設定されていません</p>
        </div>
      ) : (
        Object.entries(grouped).map(([area, areaQuestions]) => (
          <div key={area} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-5 rounded-full bg-[#10B981]" />
              <h3 className="text-sm font-semibold text-[#111827]">{area}</h3>
            </div>

            {areaQuestions.map((q) => {
              const skipKeys = getSkipKeys(q);
              const isSkipped = !!skips[q.id];
              const isComp = q.scale_type === "compensation";

              return (
                <div
                  key={q.id}
                  className={`bg-white rounded-xl border p-5 shadow-sm mb-3 transition-all ${
                    isAnswered(q) ? (isSkipped ? "border-[#E5E7EB] bg-[#F9FAFB]" : "border-[#D1FAE5]") : "border-[#E5E7EB]"
                  }`}
                >
                  <p className="text-sm text-[#374151] mb-4">
                    <span className="text-xs text-[#9CA3AF] mr-2">Q{q.num}</span>
                    {getQuestionText(q)}
                  </p>

                  {isSkipped ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-3 py-1.5 rounded-lg">{skips[q.id]}</span>
                      <button
                        onClick={() => { setSkips(prev => { const n = {...prev}; delete n[q.id]; return n; }); setAnswers(prev => { const n = {...prev}; delete n[q.id]; return n; }); }}
                        className="text-xs text-[#6B7280] hover:text-[#111827]"
                      >
                        回答に戻す
                      </button>
                    </div>
                  ) : isComp ? (
                    <div className="space-y-2">
                      {COMPENSATION_CHOICES.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => handleAnswer(q.id, c.value)}
                          className={`w-full py-2.5 px-4 rounded-xl text-sm text-left transition-all ${
                            answers[q.id] === c.value
                              ? "bg-[#10B981] text-white"
                              : "bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6]"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((score) => (
                          <button
                            key={score}
                            onClick={() => handleAnswer(q.id, score)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                              answers[q.id] === score
                                ? "bg-[#10B981] text-white shadow-sm"
                                : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6] border border-[#E5E7EB]"
                            }`}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-between mt-2 px-1">
                        <span className="text-[10px] text-[#9CA3AF]">そう思わない</span>
                        <span className="text-[10px] text-[#9CA3AF]">そう思う</span>
                      </div>
                    </>
                  )}

                  {/* Skip options */}
                  {skipKeys.length > 0 && !isSkipped && (
                    <div className="mt-3 pt-3 border-t border-[#F3F4F6] flex flex-wrap gap-2">
                      {skipKeys.map((key) => (
                        <button
                          key={key}
                          onClick={() => handleSkip(q.id, key)}
                          className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-3 py-1.5 rounded-lg hover:bg-[#E5E7EB] transition-colors"
                        >
                          {SKIP_LABELS[key] || `スキップ${key}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}

      {/* Free Text */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm mb-6">
        <label className="block text-sm font-medium text-[#374151] mb-1.5">
          自由記入 <span className="text-[#9CA3AF]">(任意)</span>
        </label>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          rows={4}
          className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981] resize-none"
          placeholder="職場環境について気づいたことがあればご記入ください"
        />
      </div>

      {/* Submit */}
      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-[#DC2626]">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !allAnswered || !orgUnit}
        className="w-full py-3.5 bg-[#10B981] text-white rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors disabled:opacity-50 shadow-sm"
      >
        {submitting ? "送信中..." : "回答を送信する"}
      </button>

      {!allAnswered && total > 0 && (
        <p className="text-xs text-[#9CA3AF] text-center mt-3">
          全ての質問に回答（またはスキップ）するまで送信できません
        </p>
      )}
    </div>
  );
}
