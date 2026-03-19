"use client";

import { useEffect, useState } from "react";
import { useSurveyContext } from "@/components/survey-context";

interface Survey {
  id: number;
  name: string;
  conducted_at: string;
}

export function SurveySelector() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const { id: selected, ready, setSelectedSurveyId } = useSurveyContext();

  useEffect(() => {
    fetch("/api/surveys")
      .then((r) => r.json())
      .then(setSurveys);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value);
    setSelectedSurveyId(id);
  };

  if (surveys.length === 0) {
    return (
      <div className="text-sm text-[#9CA3AF]">
        サーベイデータがありません。<a href="/admin" className="text-[#10B981] underline">データ管理</a>からアップロードしてください。
      </div>
    );
  }

  return (
    <select
      value={selected || ""}
      onChange={handleChange}
      disabled={!ready}
      className="border border-[#D1D5DB] rounded-xl px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
    >
      {surveys.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}（{s.conducted_at}）
        </option>
      ))}
    </select>
  );
}

export function useSurveyId(): number | null {
  return useSurveyContext().id;
}
