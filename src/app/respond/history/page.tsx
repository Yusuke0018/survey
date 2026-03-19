"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScoreBadge } from "@/components/score-badge";

interface ResponseSummary {
  response_id: number;
  survey_id: number;
  survey_name: string;
  survey_type: "clinic" | "jigyotai";
  conducted_at: string;
  respondent_type: string;
  org_unit: string;
  timestamp: string | null;
  avg_score: number | null;
  free_text: string | null;
  question_count: number;
}

interface ResponseDetail extends ResponseSummary {
  questions: Array<{
    question_id: number;
    num: number;
    text: string;
    area: string;
    area_label: string;
    score: number | null;
    skip_reason: string | null;
  }>;
}

export default function RespondHistoryPage() {
  const [items, setItems] = useState<ResponseSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ResponseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDetail = async (responseId: number) => {
    setSelectedId(responseId);
    setDetailLoading(true);

    try {
      const response = await fetch(`/api/me/responses/${responseId}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "回答詳細の取得に失敗しました");
      }
      const data = await response.json();
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "回答詳細の取得に失敗しました");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/me/responses")
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "マイ回答の取得に失敗しました");
        }
        return response.json();
      })
      .then((data) => {
        const nextItems = Array.isArray(data) ? data : [];
        setItems(nextItems);
        if (nextItems[0]) {
          void loadDetail(nextItems[0].response_id);
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const visibleDetail = selectedId ? detail : null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#DBEAFE] bg-[linear-gradient(135deg,#EFF6FF_0%,#FFFFFF_100%)] p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2563EB]">My Responses</p>
        <h1 className="mt-2 text-2xl font-bold text-[#111827]">自分の回答</h1>
        <p className="mt-2 text-sm text-[#64748B]">
          Google ログインに紐づいて保存された回答だけを表示しています。
        </p>
      </div>

      <Link href="/respond" className="inline-block text-sm text-[#2563EB] hover:underline">
        ← 回答一覧に戻る
      </Link>

      {loading ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center text-[#64748B] shadow-sm">
          読み込み中...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C]">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center text-[#64748B] shadow-sm">
          まだ自分の回答はありません
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
          <div className="space-y-3">
            {items.map((item) => {
              const isSelected = item.response_id === (selectedId ?? items[0]?.response_id);
              return (
                <button
                  key={item.response_id}
                  type="button"
                  onClick={() => { void loadDetail(item.response_id); }}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${
                    isSelected
                      ? "border-[#0F172A] bg-[#0F172A] text-white shadow-lg shadow-[#0F172A]/10"
                      : "border-[#E5E7EB] bg-white hover:border-[#CBD5E1] hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold ${isSelected ? "text-white" : "text-[#111827]"}`}>{item.survey_name}</p>
                      <p className={`mt-1 text-xs ${isSelected ? "text-white/70" : "text-[#64748B]"}`}>
                        {item.conducted_at} / {item.org_unit || "-"}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isSelected ? "bg-white/10 text-white" : "bg-[#F3F4F6] text-[#475569]"}`}>
                      {item.respondent_type}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className={`text-[10px] ${isSelected ? "text-white/70" : "text-[#64748B]"}`}>平均スコア</p>
                      <div className="mt-1">
                        <ScoreBadge score={item.avg_score} size="sm" />
                      </div>
                    </div>
                    <div className={`text-xs ${isSelected ? "text-white/70" : "text-[#64748B]"}`}>
                      {item.timestamp || "送信日時なし"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            {detailLoading ? (
              <div className="py-20 text-center text-[#64748B]">詳細を読み込み中...</div>
            ) : visibleDetail ? (
              <div>
                <div className="border-b border-[#F1F5F9] pb-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Selected Response</p>
                  <h2 className="mt-2 text-xl font-bold text-[#111827]">{visibleDetail.survey_name}</h2>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-[#64748B]">
                    <span>実施日: {visibleDetail.conducted_at}</span>
                    <span>区分: {visibleDetail.respondent_type}</span>
                    <span>{visibleDetail.org_unit || "-"}</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl bg-[#F8FAFC] p-4">
                    <p className="text-xs text-[#64748B]">平均スコア</p>
                    <div className="mt-2">
                      <ScoreBadge score={visibleDetail.avg_score} size="lg" />
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F8FAFC] p-4">
                    <p className="text-xs text-[#64748B]">送信日時</p>
                    <p className="mt-2 text-sm font-medium text-[#111827]">{visibleDetail.timestamp || "-"}</p>
                  </div>
                  <div className="rounded-xl bg-[#F8FAFC] p-4">
                    <p className="text-xs text-[#64748B]">自由記入</p>
                    <p className="mt-2 text-sm text-[#111827]">{visibleDetail.free_text?.trim() || "なし"}</p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {visibleDetail.questions.map((question) => (
                    <div key={question.question_id} className="rounded-xl border border-[#E5E7EB] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs text-[#64748B]">Q{question.num} / {question.area_label}</p>
                          <p className="mt-1 text-sm text-[#111827]">{question.text}</p>
                        </div>
                        <div className="shrink-0">
                          <ScoreBadge score={question.score} size="sm" />
                        </div>
                      </div>
                      {question.skip_reason && (
                        <p className="mt-2 text-xs text-[#B45309]">スキップ理由: {question.skip_reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-[#64748B]">回答を選択してください</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
