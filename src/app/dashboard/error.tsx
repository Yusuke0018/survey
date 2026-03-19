"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md rounded-2xl border border-[#FECACA] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#991B1B] mb-2">画面の表示に失敗しました</h2>
        <p className="text-sm text-[#6B7280] mb-4">
          想定外のデータで描画に失敗しました。再読み込みしても直らない場合は、この画面名を共有してください。
        </p>
        {error.message && (
          <p className="text-xs text-[#B91C1C] mb-4 break-words">{error.message}</p>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-[#10B981] text-white text-sm font-medium hover:bg-[#059669] transition-colors"
        >
          再試行
        </button>
      </div>
    </div>
  );
}
