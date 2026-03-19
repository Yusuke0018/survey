"use client";

import { useRouter } from "next/navigation";

export default function RespondLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#10B981] rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="text-[15px] font-bold text-[#10B981]">リベクリ サーベイ</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-[#6B7280] hover:text-[#DC2626] transition-colors"
        >
          ログアウト
        </button>
      </header>
      <main className="max-w-2xl mx-auto py-8 px-4">
        {children}
      </main>
    </div>
  );
}
