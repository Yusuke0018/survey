"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSurveyContext } from "@/components/survey-context";

interface Survey {
  id: number;
  name: string;
  conducted_at: string;
  created_at: string;
  status: string;
  survey_type: string;
  legacy_staff_count: number;
  legacy_director_count: number;
  new_staff_count: number;
  new_director_count: number;
  new_manager_count: number;
  new_corporate_count: number;
  question_count: number;
}

interface StorageInfo {
  mode: string;
  writesEnabled: boolean;
  message: string | null;
}

export default function AdminPage() {
  const { setSelectedSurveyId } = useSurveyContext();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [name, setName] = useState("");
  const [conductedAt, setConductedAt] = useState("");
  const [surveyType, setSurveyType] = useState<"clinic" | "jigyotai">("clinic");
  const [creating, setCreating] = useState(false);

  // Upload states
  const [uploadingSurveyId, setUploadingSurveyId] = useState<number | null>(null);
  const [uploadType, setUploadType] = useState<string>("staff");
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"sheet" | "csv">("sheet");
  const [sheetUrl, setSheetUrl] = useState("");
  const [importing, setImporting] = useState(false);

  const loadSurveys = () => {
    fetch("/api/surveys").then((r) => r.json()).then(setSurveys);
  };

  useEffect(() => { loadSurveys(); }, []);

  useEffect(() => {
    fetch("/api/storage")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.writesEnabled === "boolean") {
          setStorageInfo(data as StorageInfo);
        }
      })
      .catch(() => setStorageInfo(null));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !conductedAt) return;
    setCreating(true);
    const res = await fetch("/api/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, conducted_at: conductedAt, survey_type: surveyType }),
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

  const handleSheetImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadingSurveyId || !sheetUrl) return;

    setImporting(true);
    setUploadResult(null);
    try {
      const res = await fetch(`/api/surveys/${uploadingSurveyId}/import-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetUrl, type: uploadType }),
      });

      const data = await res.json();
      if (res.ok) {
        const matched = data.totalQuestions ? `${data.matchedQuestions}/${data.totalQuestions}問マッチ` : `${data.matchedQuestions}問マッチ`;
        setUploadResult(`${data.count}件の回答をインポートしました（${matched}）${data.warnings?.length ? "\n" + data.warnings.join("; ") : ""}`);
        setSelectedSurveyId(uploadingSurveyId);
        loadSurveys();
        setSheetUrl("");
      } else {
        setUploadResult(`エラー: ${data.error || res.statusText}`);
      }
    } catch (err) {
      setUploadResult(`エラー: ${err instanceof Error ? err.message : "通信エラーが発生しました"}`);
    } finally {
      setImporting(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadingSurveyId) return;

    const form = e.target as HTMLFormElement;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    if (!fileInput.files?.length) return;

    const formData = new FormData();
    formData.append("csv", fileInput.files[0]);
    formData.append("type", uploadType);

    setUploadResult(null);
    try {
      const res = await fetch(`/api/surveys/${uploadingSurveyId}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        const matched = data.totalQuestions ? `${data.matchedQuestions}/${data.totalQuestions}問マッチ` : `${data.matchedQuestions}問マッチ`;
        setUploadResult(`${data.count}件の回答をインポートしました（${matched}）${data.warnings?.length ? "\n" + data.warnings.join("; ") : ""}`);
        setSelectedSurveyId(uploadingSurveyId);
        loadSurveys();
        fileInput.value = "";
      } else {
        setUploadResult(`エラー: ${data.error || res.statusText}`);
      }
    } catch (err) {
      setUploadResult(`エラー: ${err instanceof Error ? err.message : "通信エラーが発生しました"}`);
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

      {storageInfo && !storageInfo.writesEnabled && storageInfo.message && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 shadow-sm mb-6">
          <p className="text-sm font-semibold text-[#B91C1C] mb-1">保存機能は無効です</p>
          <p className="text-sm text-[#7F1D1D]">{storageInfo.message}</p>
        </div>
      )}

      {/* Create Survey */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm mb-8">
        <h3 className="text-sm font-semibold text-[#111827] mb-4">新規サーベイ作成</h3>
        <form onSubmit={handleCreate} className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-xs text-[#6B7280] mb-1.5">タイプ</label>
            <select
              value={surveyType}
              onChange={(e) => setSurveyType(e.target.value as "clinic" | "jigyotai")}
              className="border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981] bg-white"
            >
              <option value="clinic">クリニック</option>
              <option value="jigyotai">事業体</option>
            </select>
          </div>
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
                <td className="px-5 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mr-1 ${
                    s.survey_type === "jigyotai" ? "bg-[#EDE9FE] text-[#7C3AED]" : "bg-[#DBEAFE] text-[#2563EB]"
                  }`}>
                    {s.survey_type === "jigyotai" ? "事業体" : "クリニック"}
                  </span>
                  {getStatusBadge(s.status)}
                </td>
                <td className="px-5 py-3 text-center text-[#374151]">{s.question_count}問</td>
                <td className="px-5 py-3 text-center text-[#374151]">
                  {s.survey_type === "jigyotai" ? (
                    <>
                      S:{s.new_staff_count} M:{s.new_manager_count} C:{s.new_corporate_count}
                    </>
                  ) : (
                    <>
                      {s.legacy_staff_count + s.new_staff_count}件
                      <span className="text-[#9CA3AF] ml-1">(院長: {s.legacy_director_count + s.new_director_count})</span>
                    </>
                  )}
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
                      onClick={() => {
                        setSelectedSurveyId(s.id);
                        setUploadingSurveyId(s.id);
                        setUploadType("staff");
                        setUploadResult(null);
                        setImportMode("sheet");
                        setSheetUrl("");
                      }}
                      className="text-xs px-3 py-1.5 bg-[#F3F4F6] text-[#374151] rounded-lg hover:bg-[#E5E7EB] transition-colors"
                    >
                      データ取込
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

      {/* Import Modal */}
      {uploadingSurveyId && (() => {
        const uploadingSurvey = surveys.find((s) => s.id === uploadingSurveyId);
        return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#111827]">過去データの取込</h3>
              <button onClick={() => setUploadingSurveyId(null)} className="text-[#6B7280] hover:text-[#111827] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-[#6B7280] mb-4">
              サーベイ: {surveys.find((s) => s.id === uploadingSurveyId)?.name}
            </p>

            {/* Import mode toggle */}
            <div className="flex gap-1 mb-4 bg-[#F3F4F6] rounded-lg p-1">
              <button
                onClick={() => setImportMode("sheet")}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  importMode === "sheet" ? "bg-white text-[#111827] shadow-sm" : "text-[#6B7280]"
                }`}
              >
                スプレッドシート
              </button>
              <button
                onClick={() => setImportMode("csv")}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  importMode === "csv" ? "bg-white text-[#111827] shadow-sm" : "text-[#6B7280]"
                }`}
              >
                CSVファイル
              </button>
            </div>

            {/* Respondent type selector */}
            <div className="flex gap-2 mb-4">
              {(uploadingSurvey?.survey_type === "jigyotai"
                ? [
                    { type: "staff", label: "スタッフ回答", activeColor: "bg-[#10B981]" },
                    { type: "manager", label: "責任者回答", activeColor: "bg-[#8B5CF6]" },
                    { type: "corporate", label: "経営企画室回答", activeColor: "bg-[#F59E0B]" },
                  ]
                : [
                    { type: "staff", label: "スタッフ回答", activeColor: "bg-[#10B981]" },
                    { type: "director", label: "院長回答", activeColor: "bg-[#8B5CF6]" },
                  ]
              ).map((entry) => (
                <button
                  key={entry.type}
                  onClick={() => setUploadType(entry.type)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                    uploadType === entry.type ? `${entry.activeColor} text-white` : "bg-[#F3F4F6] text-[#6B7280]"
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            {importMode === "sheet" ? (
              <form onSubmit={handleSheetImport}>
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
                />
                <p className="text-[10px] text-[#9CA3AF] mb-4">
                  共有設定を「リンクを知っている全員が閲覧可」にしてください
                </p>
                <button
                  type="submit"
                  disabled={importing || !sheetUrl}
                  className="w-full py-2.5 bg-[#10B981] text-white rounded-xl text-sm font-semibold hover:bg-[#059669] transition-colors disabled:opacity-50"
                >
                  {importing ? "取込中..." : "スプレッドシートから取込"}
                </button>
              </form>
            ) : (
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
                  CSVアップロード
                </button>
              </form>
            )}

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
        );
      })()}
    </div>
  );
}
