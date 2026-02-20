"use client";

import { Sidebar } from "@/components/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      <Sidebar />
      <div className="ml-60">
        <main className="p-8 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
