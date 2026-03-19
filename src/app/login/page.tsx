"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

function subscribeToLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function getOauthErrorSnapshot() {
  return new URLSearchParams(window.location.search).get("error") || "";
}

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const oauthError = useSyncExternalStore(
    subscribeToLocation,
    getOauthErrorSnapshot,
    () => ""
  );
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.role === "admin") {
        router.push("/dashboard");
      } else {
        router.push("/respond");
      }
    } else {
      const data = await res.json();
      setError(data.error || "ログインに失敗しました");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFB]">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-lg border border-[#E5E7EB] p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-[#10B981] rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[#111827]">リベクリ サーベイ</h1>
            <p className="text-sm text-[#6B7280] mt-1">スタッフ満足度調査システム</p>
          </div>

          <a
            href="/api/auth/google/start?callbackUrl=/respond"
            className="mb-5 flex w-full items-center justify-center gap-3 rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition-all hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6.1-2.8-6.1-6.3S8.7 5.4 12 5.4c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 2.8 14.7 2 12 2 6.9 2 2.8 6.2 2.8 11.7S6.9 21.4 12 21.4c6.9 0 8.6-4.9 8.6-7.4 0-.5 0-.9-.1-1.2H12Z" />
              <path fill="#34A853" d="M2.8 11.7c0 1.8.6 3.4 1.6 4.7l3.1-2.4c-.3-.7-.5-1.5-.5-2.3s.2-1.6.5-2.3L4.4 7c-1 1.3-1.6 2.9-1.6 4.7Z" />
              <path fill="#FBBC05" d="M12 21.4c2.7 0 4.9-.9 6.5-2.4l-3.1-2.6c-.8.6-2 1.1-3.4 1.1-2.6 0-4.8-1.8-5.6-4.2l-3.1 2.4C5 18.9 8.2 21.4 12 21.4Z" />
              <path fill="#4285F4" d="M18.5 19c1.9-1.8 3.1-4.4 3.1-7.3 0-.5 0-.9-.1-1.5H12v3.9h5.5c-.2 1.2-.9 2.2-1.9 3l2.9 1.9Z" />
            </svg>
            スタッフは Google でログイン
          </a>

          <div className="mb-5 flex items-center gap-3 text-xs text-[#94A3B8]">
            <div className="h-px flex-1 bg-[#E5E7EB]" />
            <span>管理者ログイン</span>
            <div className="h-px flex-1 bg-[#E5E7EB]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">管理者パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-[#D1D5DB] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981] transition-all"
                placeholder="パスワードを入力"
                autoFocus
              />
            </div>

            {(oauthError || error) && (
              <p className="text-sm text-[#DC2626] bg-[#FEF2F2] px-4 py-2.5 rounded-xl">{oauthError || error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 bg-[#10B981] text-white rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#F3F4F6]">
            <p className="text-xs text-[#9CA3AF] text-center">
              スタッフ回答は Google アカウントに紐づいて保存されます
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
