"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

export type SurveyType = "clinic" | "jigyotai";

interface SurveyInfo {
  id: number | null;
  type: SurveyType;
}

const SurveyContext = createContext<SurveyInfo>({ id: null, type: "clinic" });

export function useSurveyContext() {
  return useContext(SurveyContext);
}

export function SurveyProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get("surveyId");
  const numericSurveyId = surveyId ? parseInt(surveyId) : null;
  const [type, setType] = useState<SurveyType>("clinic");

  useEffect(() => {
    if (!numericSurveyId) {
      return;
    }

    fetch("/api/surveys")
      .then((r) => r.json())
      .then((surveys: Array<{ id: number; survey_type: SurveyType }>) => {
        const found = surveys.find((s) => s.id === numericSurveyId);
        setType(found?.survey_type || "clinic");
      })
      .catch(() => setType("clinic"));
  }, [numericSurveyId]);

  const info: SurveyInfo = {
    id: numericSurveyId,
    type: numericSurveyId ? type : "clinic",
  };

  return (
    <SurveyContext.Provider value={info}>
      {children}
    </SurveyContext.Provider>
  );
}
