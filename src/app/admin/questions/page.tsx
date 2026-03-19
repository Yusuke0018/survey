"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QUESTIONS } from "@/lib/questions";

interface Question {
  num: number;
  staff_text: string;
  director_text: string;
  area: string;
  area_label: string;
}

const DEFAULT_AREAS = [
  { key: "safety", label: "心理的安全性" },
  { key: "director", label: "院長との関係性" },
  { key: "teamwork", label: "チームワーク" },
  { key: "growth", label: "働きがい・成長" },
  { key: "trust", label: "組織への信頼" },
];

function QuestionsEditor() {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get("surveyId");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!surveyId) return;
    fetch(`/api/surveys/${surveyId}/questions`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setQuestions(data.map((q: Question) => ({
            num: q.num,
            staff_text: q.staff_text,
            director_text: q.director_text,
            area: q.area,
            area_label: q.area_label,
          })));
        }
        setLoading(false);
      });
  }, [surveyId]);

  const loadDefaults = () => {
    setQuestions(QUESTIONS.map((q) => ({
      num: q.num,
      staff_text: q.staffText,
      director_text: q.directorText,
      area: q.area,
      area_label: q.areaLabel,
    })));
  };

  const addQuestion = () => {
    const nextNum = questions.length > 0 ? Math.max(...questions.map(q => q.num)) + 1 : 1;
    setQuestions([...questions, {
      num: nextNum,
      staff_text: "",
      director_text: "",
      area: "safety",
      area_label: "心理的安全性",
    }]);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated.map((q, i) => ({ ...q, num: i + 1 })));
  };

  const updateQuestion = (index: number, field: keyof Question, value: string) => {
    const updated = [...questions];
    if (field === "area") {
      const area = DEFAULT_AREAS.find(a => a.key === value);
      updated[index] = { ...updated[index], area: value, area_label: area?.label || value };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setQuestions(updated);
  };

  const handleSave = async () => {
    if (!surveyId) return;
    setSaving(true);
    setSaved(false);
    await fetch(`/api/surveys/${surveyId}/questions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (!surveyId) {
    return (
      <div className="text-center py-20 text-[#6B7280]">
        管理画面からサーベイを選択してください
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#111827]">質問テンプレート編集</h2>
        <div className="flex gap-3">
          {questions.length === 0 && (
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
            disabled={saving || questions.length === 0}
            className="px-6 py-2 bg-[#10B981] text-white rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors disabled:opacity-50"
          >
            {saving ? "保存中..." : saved ? "保存しました" : "保存"}
          </button>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center shadow-sm">
          <p className="text-[#6B7280] mb-4">質問が設定されていません</p>
          <button
            onClick={loadDefaults}
            className="px-6 py-2.5 bg-[#10B981] text-white rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors"
          >
            デフォルト質問セットを読み込む
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, index) => (
            <div key={index} className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[#10B981] bg-[#ECFDF5] px-3 py-1 rounded-lg">
                    Q{q.num}
                  </span>
                  <select
                    value={q.area}
                    onChange={(e) => updateQuestion(index, "area", e.target.value)}
                    className="text-xs border border-[#D1D5DB] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#10B981]/30"
                  >
                    {DEFAULT_AREAS.map((a) => (
                      <option key={a.key} value={a.key}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => removeQuestion(index)}
                  className="text-[#9CA3AF] hover:text-[#DC2626] transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">スタッフ向け質問文</label>
                  <textarea
                    value={q.staff_text}
                    onChange={(e) => updateQuestion(index, "staff_text", e.target.value)}
                    rows={2}
                    className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981] resize-none"
                    placeholder="スタッフに表示する質問文"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1">院長向け質問文</label>
                  <textarea
                    value={q.director_text}
                    onChange={(e) => updateQuestion(index, "director_text", e.target.value)}
                    rows={2}
                    className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981] resize-none"
                    placeholder="院長に表示する質問文"
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
