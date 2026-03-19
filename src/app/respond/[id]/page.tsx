"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CLINICS } from "@/lib/clinics";

interface Question {
  id: number;
  num: number;
  staff_text: string;
  area: string;
  area_label: string;
}

export default function RespondSurveyPage() {
  const params = useParams();
  const surveyId = params.id as string;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [clinic, setClinic] = useState("");
  const [respondentName, setRespondentName] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/surveys/${surveyId}/questions`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setQuestions(data);
        }
        setLoading(false);
      });
  }, [surveyId]);

  const getSessionToken = (): string => {
    const key = `survey_session_${surveyId}`;
    let token = localStorage.getItem(key);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(key, token);
    }
    return token;
  };

  const handleAnswer = (questionId: number, score: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));
  };

  const handleSubmit = async () => {
    if (!clinic) { setError("拠点を選択してください"); return; }
    const unanswered = questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      setError(`未回答の質問があります（Q${unanswered.map(q => q.num).join(", Q")}）`);
      return;
    }

    setSubmitting(true);
    setError("");

    const res = await fetch(`/api/surveys/${surveyId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinic,
        respondentName: respondentName || undefined,
        freeText: freeText || undefined,
        sessionToken: getSessionToken(),
        answers: Object.entries(answers).map(([qId, score]) => ({
          questionId: parseInt(qId),
          score,
        })),
      }),
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
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center shadow-sm">
        <p className="text-[#6B7280]">このサーベイには質問が設定されていません</p>
      </div>
    );
  }

  // Group by area
  const grouped: Record<string, Question[]> = {};
  for (const q of questions) {
    if (!grouped[q.area]) grouped[q.area] = [];
    grouped[q.area].push(q);
  }

  const allAnswered = questions.every((q) => answers[q.id]);
  const progress = Object.keys(answers).length;
  const total = questions.length;

  return (
    <div>
      {/* Progress */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#374151]">回答進捗</span>
          <span className="text-sm text-[#6B7280]">{progress} / {total}</span>
        </div>
        <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#10B981] rounded-full transition-all duration-300"
            style={{ width: `${(progress / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Clinic & Name */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              所属拠点 <span className="text-[#DC2626]">*</span>
            </label>
            <select
              value={clinic}
              onChange={(e) => setClinic(e.target.value)}
              className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981] bg-white"
            >
              <option value="">選択してください</option>
              {CLINICS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
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
      {Object.entries(grouped).map(([area, areaQuestions]) => (
        <div key={area} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-5 rounded-full bg-[#10B981]" />
            <h3 className="text-sm font-semibold text-[#111827]">{areaQuestions[0].area_label}</h3>
          </div>

          {areaQuestions.map((q) => (
            <div
              key={q.id}
              className={`bg-white rounded-xl border p-5 shadow-sm mb-3 transition-all ${
                answers[q.id] ? "border-[#D1FAE5]" : "border-[#E5E7EB]"
              }`}
            >
              <p className="text-sm text-[#374151] mb-4">
                <span className="text-xs text-[#9CA3AF] mr-2">Q{q.num}</span>
                {q.staff_text}
              </p>
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
                <span className="text-[10px] text-[#9CA3AF]">全くそう思わない</span>
                <span className="text-[10px] text-[#9CA3AF]">非常にそう思う</span>
              </div>
            </div>
          ))}
        </div>
      ))}

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
        disabled={submitting || !allAnswered || !clinic}
        className="w-full py-3.5 bg-[#10B981] text-white rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors disabled:opacity-50 shadow-sm"
      >
        {submitting ? "送信中..." : "回答を送信する"}
      </button>

      {!allAnswered && (
        <p className="text-xs text-[#9CA3AF] text-center mt-3">
          全ての質問に回答するまで送信できません
        </p>
      )}
    </div>
  );
}
