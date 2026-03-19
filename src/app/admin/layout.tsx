"use client";

import { Sidebar } from "@/components/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      <Sidebar />
      <div className="ml-[260px]">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-[#E5E7EB] px-8 py-3.5">
          <h1 className="text-sm font-medium text-[#6B7280]">管理</h1>
        </header>
        <main className="p-8 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
