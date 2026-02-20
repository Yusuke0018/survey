"use client";

import { useEffect, useState } from "react";

interface Survey {
  id: number;
  name: string;
  conducted_at: string;
  created_at: string;
  staff_count: number;
  director_count: number;
}

export default function AdminPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [name, setName] = useState("");
  const [conductedAt, setConductedAt] = useState("");
  const [creating, setCreating] = useState(false);

  // Upload states
  const [uploadingSurveyId, setUploadingSurveyId] = useState<number | null>(null);
  const [uploadType, setUploadType] = useState<"staff" | "director">("staff");
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  const loadSurveys = () => {
    fetch("/api/surveys").then((r) => r.json()).then(setSurveys);
  };

  useEffect(() => { loadSurveys(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !conductedAt) return;
    setCreating(true);
    const res = await fetch("/api/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, conducted_at: conductedAt }),
    });
    if (res.ok) {
      setName("");
      setConductedAt("");
      loadSurveys();
    }
    setCreating(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("このサーベイを削除しますか？関連する全ての回答データも削除されます。")) return;
    await fetch(`/api/surveys/${id}`, { method: "DELETE" });
    loadSurveys();
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadingSurveyId) return;

    const form = e.target as HTMLFormElement;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    if (!fileInput.files?.length) return;

    const formData = new FormData();
    formData.append("csv", fileInput.files[0]);

    setUploadResult(null);
    const res = await fetch(`/api/surveys/${uploadingSurveyId}/upload/${uploadType}`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (res.ok) {
      setUploadResult(`✅ ${data.count}件の回答をインポートしました（${data.matchedQuestions}/15問マッチ）${data.warnings?.length ? "\n⚠️ " + data.warnings.join("; ") : ""}`);
      loadSurveys();
      fileInput.value = "";
    } else {
      setUploadResult(`❌ エラー: ${data.error}`);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#1E293B] mb-6">データ管理</h2>

      {/* Create Survey */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm mb-8">
        <h3 className="text-[15px] font-medium text-[#1E293B] mb-4">新規サーベイ作成</h3>
        <form onSubmit={handleCreate} className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs text-[#64748B] mb-1">サーベイ名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              placeholder="例: 第1回スタッフサーベイ"
            />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">実施日</label>
            <input
              type="date"
              value={conductedAt}
              onChange={(e) => setConductedAt(e.target.value)}
              className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !name || !conductedAt}
            className="px-6 py-2 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
          >
            作成
          </button>
        </form>
      </div>

      {/* Survey List */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#FAFBFC] border-b border-[#E2E8F0]">
              <th className="text-left px-5 py-3 text-[#64748B] font-medium">名称</th>
              <th className="text-left px-5 py-3 text-[#64748B] font-medium">実施日</th>
              <th className="text-center px-5 py-3 text-[#64748B] font-medium">スタッフ回答</th>
              <th className="text-center px-5 py-3 text-[#64748B] font-medium">院長回答</th>
              <th className="text-right px-5 py-3 text-[#64748B] font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {surveys.map((s) => (
              <tr key={s.id} className="border-b border-[#E2E8F0]/50 hover:bg-[#FAFBFC]">
                <td className="px-5 py-3 font-medium text-[#1E293B]">{s.name}</td>
                <td className="px-5 py-3 text-[#64748B]">{s.conducted_at}</td>
                <td className="px-5 py-3 text-center text-[#1E293B]">{s.staff_count}件</td>
                <td className="px-5 py-3 text-center text-[#1E293B]">{s.director_count}件</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setUploadingSurveyId(s.id); setUploadType("staff"); setUploadResult(null); }}
                      className="text-xs px-3 py-1.5 bg-[#EFF6FF] text-[#2563EB] rounded-lg hover:bg-[#DBEAFE]"
                    >
                      スタッフCSV
                    </button>
                    <button
                      onClick={() => { setUploadingSurveyId(s.id); setUploadType("director"); setUploadResult(null); }}
                      className="text-xs px-3 py-1.5 bg-[#F5F3FF] text-[#8B5CF6] rounded-lg hover:bg-[#EDE9FE]"
                    >
                      院長CSV
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-xs px-3 py-1.5 bg-[#FEE2E2] text-[#991B1B] rounded-lg hover:bg-[#FECACA]"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {surveys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-[#64748B]">サーベイがありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Upload Modal */}
      {uploadingSurveyId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-medium text-[#1E293B]">
                {uploadType === "staff" ? "スタッフ" : "院長"}CSVアップロード
              </h3>
              <button onClick={() => setUploadingSurveyId(null)} className="text-[#64748B] hover:text-[#1E293B]">✕</button>
            </div>

            <p className="text-xs text-[#64748B] mb-4">
              サーベイ: {surveys.find((s) => s.id === uploadingSurveyId)?.name}
            </p>

            <form onSubmit={handleUpload}>
              <input
                type="file"
                accept=".csv"
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm mb-4"
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-[#1D4ED8]"
              >
                アップロード
              </button>
            </form>

            {uploadResult && (
              <pre className="mt-4 text-xs p-3 rounded-lg bg-[#FAFBFC] border border-[#E2E8F0] whitespace-pre-wrap">
                {uploadResult}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
