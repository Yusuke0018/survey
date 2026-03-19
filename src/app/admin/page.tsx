"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Survey {
  id: number;
  name: string;
  conducted_at: string;
  created_at: string;
  status: string;
  legacy_staff_count: number;
  legacy_director_count: number;
  new_staff_count: number;
  new_director_count: number;
  question_count: number;
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

  const handleStatusToggle = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "draft" : "active";
    await fetch(`/api/surveys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
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
      setUploadResult(`${data.count}件の回答をインポートしました（${data.matchedQuestions}/15問マッチ）${data.warnings?.length ? "\n" + data.warnings.join("; ") : ""}`);
      loadSurveys();
      fileInput.value = "";
    } else {
      setUploadResult(`エラー: ${data.error}`);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") {
      return <span className="text-xs px-2 py-1 rounded-full bg-[#ECFDF5] text-[#059669] font-medium">公開中</span>;
    }
    return <span className="text-xs px-2 py-1 rounded-full bg-[#F3F4F6] text-[#6B7280] font-medium">下書き</span>;
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-[#111827] mb-6">データ管理</h2>

      {/* Create Survey */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm mb-8">
        <h3 className="text-sm font-semibold text-[#111827] mb-4">新規サーベイ作成</h3>
        <form onSubmit={handleCreate} className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs text-[#6B7280] mb-1.5">サーベイ名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
              placeholder="例: 第1回スタッフサーベイ"
            />
          </div>
          <div>
            <label className="block text-xs text-[#6B7280] mb-1.5">実施日</label>
            <input
              type="date"
              value={conductedAt}
              onChange={(e) => setConductedAt(e.target.value)}
              className="border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !name || !conductedAt}
            className="px-6 py-2.5 bg-[#10B981] text-white rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors disabled:opacity-50"
          >
            作成
          </button>
        </form>
      </div>

      {/* Survey List */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
              <th className="text-left px-5 py-3 text-[#6B7280] font-medium">名称</th>
              <th className="text-left px-5 py-3 text-[#6B7280] font-medium">実施日</th>
              <th className="text-center px-5 py-3 text-[#6B7280] font-medium">ステータス</th>
              <th className="text-center px-5 py-3 text-[#6B7280] font-medium">質問数</th>
              <th className="text-center px-5 py-3 text-[#6B7280] font-medium">回答数</th>
              <th className="text-right px-5 py-3 text-[#6B7280] font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {surveys.map((s) => (
              <tr key={s.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                <td className="px-5 py-3 font-medium text-[#111827]">{s.name}</td>
                <td className="px-5 py-3 text-[#6B7280]">{s.conducted_at}</td>
                <td className="px-5 py-3 text-center">{getStatusBadge(s.status)}</td>
                <td className="px-5 py-3 text-center text-[#374151]">{s.question_count}問</td>
                <td className="px-5 py-3 text-center text-[#374151]">
                  {s.legacy_staff_count + s.new_staff_count}件
                  <span className="text-[#9CA3AF] ml-1">(院長: {s.legacy_director_count + s.new_director_count})</span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/questions?surveyId=${s.id}`}
                      className="text-xs px-3 py-1.5 bg-[#ECFDF5] text-[#059669] rounded-lg hover:bg-[#D1FAE5] transition-colors"
                    >
                      質問編集
                    </Link>
                    <button
                      onClick={() => handleStatusToggle(s.id, s.status)}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        s.status === "active"
                          ? "bg-[#FEF3C7] text-[#92400E] hover:bg-[#FDE68A]"
                          : "bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE]"
                      }`}
                    >
                      {s.status === "active" ? "非公開にする" : "公開する"}
                    </button>
                    <button
                      onClick={() => { setUploadingSurveyId(s.id); setUploadType("staff"); setUploadResult(null); }}
                      className="text-xs px-3 py-1.5 bg-[#F3F4F6] text-[#374151] rounded-lg hover:bg-[#E5E7EB] transition-colors"
                    >
                      CSVアップ
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-xs px-3 py-1.5 bg-[#FEF2F2] text-[#DC2626] rounded-lg hover:bg-[#FEE2E2] transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {surveys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-[#6B7280]">サーベイがありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Upload Modal */}
      {uploadingSurveyId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#111827]">CSVアップロード</h3>
              <button onClick={() => setUploadingSurveyId(null)} className="text-[#6B7280] hover:text-[#111827] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-[#6B7280] mb-4">
              サーベイ: {surveys.find((s) => s.id === uploadingSurveyId)?.name}
            </p>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setUploadType("staff")}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                  uploadType === "staff" ? "bg-[#10B981] text-white" : "bg-[#F3F4F6] text-[#6B7280]"
                }`}
              >
                スタッフ回答
              </button>
              <button
                onClick={() => setUploadType("director")}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                  uploadType === "director" ? "bg-[#8B5CF6] text-white" : "bg-[#F3F4F6] text-[#6B7280]"
                }`}
              >
                院長回答
              </button>
            </div>

            <form onSubmit={handleUpload}>
              <input
                type="file"
                accept=".csv"
                className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm mb-4"
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-[#10B981] text-white rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors"
              >
                アップロード
              </button>
            </form>

            {uploadResult && (
              <div className={`mt-4 text-xs p-3 rounded-xl whitespace-pre-wrap ${
                uploadResult.startsWith("エラー")
                  ? "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]"
                  : "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]"
              }`}>
                {uploadResult}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
