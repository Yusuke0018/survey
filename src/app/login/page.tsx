"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
      router.push("/dashboard");
    } else {
      const data = await res.json();
      setError(data.error || "ログインに失敗しました");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC]">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#1E293B]">リベクリ サーベイ</h1>
            <p className="text-sm text-[#64748B] mt-2">スタッフ満足度ダッシュボード</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
                placeholder="パスワードを入力"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-[#991B1B] bg-[#FEE2E2] px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
