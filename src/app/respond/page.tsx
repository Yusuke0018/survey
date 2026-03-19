"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ActiveSurvey {
  id: number;
  name: string;
  conducted_at: string;
  question_count: number;
}

interface AuthMe {
  provider: "admin" | "google" | null;
  user: {
    email: string;
    name: string | null;
  } | null;
}

export default function RespondPage() {
  const [surveys, setSurveys] = useState<ActiveSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [authMe, setAuthMe] = useState<AuthMe | null>(null);

  useEffect(() => {
    fetch("/api/surveys/active")
      .then((r) => r.json())
      .then((data) => {
        setSurveys(data);
        setLoading(false);
      });

    fetch("/api/auth/me")
      .then((response) => response.json())
      .then(setAuthMe)
      .catch(() => setAuthMe(null));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full" />
        <span className="ml-3 text-sm text-[#6B7280]">読み込み中...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-xl font-bold text-[#111827] mb-2">アンケート回答</h1>
        <p className="text-sm text-[#6B7280]">回答可能なサーベイを選択してください</p>
      </div>

      {authMe?.provider === "google" && (
        <div className="mb-6 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#1D4ED8]">
                {authMe.user?.name || authMe.user?.email} としてログイン中
              </p>
              <p className="mt-1 text-xs text-[#475569]">
                これからの回答は Google アカウントに紐づいて保存され、あとからマイ回答で見返せます。
              </p>
            </div>
            <Link href="/respond/history" className="shrink-0 text-sm font-semibold text-[#2563EB] hover:underline">
              マイ回答を見る
            </Link>
          </div>
        </div>
      )}

      {surveys.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center shadow-sm">
          <div className="w-14 h-14 bg-[#F3F4F6] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-[#6B7280]">現在回答可能なサーベイはありません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {surveys.map((s) => (
            <Link
              key={s.id}
              href={`/respond/${s.id}`}
              className="block bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm hover:shadow-md hover:border-[#10B981]/30 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[#111827] group-hover:text-[#10B981] transition-colors">
                    {s.name}
                  </h3>
                  <p className="text-sm text-[#6B7280] mt-1">
                    実施日: {s.conducted_at} / 質問数: {s.question_count}問
                  </p>
                </div>
                <svg className="w-5 h-5 text-[#9CA3AF] group-hover:text-[#10B981] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
