"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type SurveyType = "clinic" | "jigyotai";
export const SURVEY_STORAGE_KEY = "selectedSurveyId";

interface SurveyInfo {
  id: number | null;
  type: SurveyType;
  ready: boolean;
  setSelectedSurveyId: (id: number | null) => void;
}

const SurveyContext = createContext<SurveyInfo>({
  id: null,
  type: "clinic",
  ready: false,
  setSelectedSurveyId: () => undefined,
});

export function useSurveyContext() {
  return useContext(SurveyContext);
}

function parseSurveyId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function canSyncSurvey(pathname: string): boolean {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
}

export function SurveyProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const [info, setInfo] = useState<Omit<SurveyInfo, "setSelectedSurveyId">>({
    id: null,
    type: "clinic",
    ready: false,
  });

  useEffect(() => {
    let cancelled = false;

    const syncSurvey = async () => {
      const paramId = parseSurveyId(searchParams.get("surveyId"));
      const storedId = typeof window === "undefined"
        ? null
        : parseSurveyId(window.localStorage.getItem(SURVEY_STORAGE_KEY));

      try {
        const response = await fetch("/api/surveys");
        const surveys = await response.json() as Array<{ id: number; survey_type: SurveyType }>;
        if (cancelled) return;

        const resolvedId = [paramId, storedId].find((candidate) =>
          candidate != null && surveys.some((survey) => survey.id === candidate)
        ) ?? surveys[0]?.id ?? null;

        const found = surveys.find((survey) => survey.id === resolvedId);

        setInfo({
          id: resolvedId,
          type: found?.survey_type ?? "clinic",
          ready: true,
        });

        if (typeof window !== "undefined") {
          if (resolvedId) {
            window.localStorage.setItem(SURVEY_STORAGE_KEY, String(resolvedId));
          } else {
            window.localStorage.removeItem(SURVEY_STORAGE_KEY);
          }
        }

        if (resolvedId && canSyncSurvey(pathname) && paramId !== resolvedId) {
          const params = new URLSearchParams(searchParamsString);
          params.set("surveyId", String(resolvedId));
          const query = params.toString();
          router.replace(query ? `${pathname}?${query}` : pathname);
        }
      } catch {
        if (cancelled) return;
        setInfo({
          id: paramId ?? storedId,
          type: "clinic",
          ready: true,
        });
      }
    };

    syncSurvey();

    return () => {
      cancelled = true;
    };
  }, [pathname, router, searchParams, searchParamsString]);

  const setSelectedSurveyId = (id: number | null) => {
    setInfo((current) => ({ ...current, id }));

    if (typeof window !== "undefined") {
      if (id) {
        window.localStorage.setItem(SURVEY_STORAGE_KEY, String(id));
      } else {
        window.localStorage.removeItem(SURVEY_STORAGE_KEY);
      }
    }

    if (!canSyncSurvey(pathname)) {
      return;
    }

    const params = new URLSearchParams(searchParamsString);
    if (id) {
      params.set("surveyId", String(id));
    } else {
      params.delete("surveyId");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <SurveyContext.Provider value={{ ...info, setSelectedSurveyId }}>
      {children}
    </SurveyContext.Provider>
  );
}
