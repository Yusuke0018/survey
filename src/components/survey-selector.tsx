"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Survey {
  id: number;
  name: string;
  conducted_at: string;
}

export function SurveySelector() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    fetch("/api/surveys")
      .then((r) => r.json())
      .then((data) => {
        setSurveys(data);
        const paramId = searchParams.get("surveyId");
        if (paramId) {
          setSelected(parseInt(paramId));
        } else if (data.length > 0) {
          setSelected(data[0].id);
        }
      });
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value);
    setSelected(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("surveyId", String(id));
    router.push(`?${params.toString()}`);
  };

  if (surveys.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        サーベイデータがありません。<a href="/admin" className="text-[#2563EB] underline">データ管理</a>からアップロードしてください。
      </div>
    );
  }

  return (
    <select
      value={selected || ""}
      onChange={handleChange}
      className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
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
  const searchParams = useSearchParams();
  const [surveys, setSurveys] = useState<Survey[]>([]);

  useEffect(() => {
    fetch("/api/surveys")
      .then((r) => r.json())
      .then(setSurveys);
  }, []);

  const paramId = searchParams.get("surveyId");
  if (paramId) return parseInt(paramId);
  if (surveys.length > 0) return surveys[0].id;
  return null;
}
