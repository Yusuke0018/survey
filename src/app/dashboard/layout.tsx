"use client";

import { Sidebar } from "@/components/sidebar";
import { SurveySelector } from "@/components/survey-selector";
import { Suspense } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      <Sidebar />
      <div className="ml-60">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-[#E2E8F0] px-8 py-4 flex items-center justify-between">
          <div />
          <Suspense fallback={<div className="text-sm text-muted-foreground">読み込み中...</div>}>
            <SurveySelector />
          </Suspense>
        </header>
        <main className="p-8 animate-fade-in">
          <Suspense fallback={<div className="text-center py-20 text-muted-foreground">読み込み中...</div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
