"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "全体ダッシュボード", icon: "📊" },
  { href: "/dashboard/clinics", label: "拠点別", icon: "🏥" },
  { href: "/dashboard/gap", label: "ギャップ分析", icon: "⚖️" },
  { href: "/dashboard/retention", label: "離職リスク", icon: "⚠️" },
  { href: "/dashboard/responses", label: "個別回答", icon: "👤" },
  { href: "/dashboard/trends", label: "時系列比較", icon: "📈" },
];

const adminItems = [
  { href: "/admin", label: "データ管理", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden bg-[#1E293B] text-white p-2 rounded-lg"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? "☰" : "✕"}
      </button>

      <aside
        className={cn(
          "fixed left-0 top-0 h-full bg-[#1E293B] text-white flex flex-col z-40 transition-transform duration-200",
          "w-60",
          collapsed ? "-translate-x-full md:translate-x-0" : "translate-x-0"
        )}
      >
        <div className="p-5 border-b border-[#334155]">
          <h1 className="text-lg font-bold">リベクリ サーベイ</h1>
          <p className="text-xs text-gray-400 mt-1">スタッフ満足度分析</p>
        </div>

        <nav className="flex-1 py-4">
          <div className="px-3 mb-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">ダッシュボード</span>
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-5 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-[#334155] border-l-[3px] border-[#3B82F6] text-white"
                    : "text-gray-400 hover:text-white hover:bg-[#334155]/50 border-l-[3px] border-transparent"
                )}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="px-3 mt-6 mb-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">管理</span>
          </div>
          {adminItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-5 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-[#334155] border-l-[3px] border-[#3B82F6] text-white"
                    : "text-gray-400 hover:text-white hover:bg-[#334155]/50 border-l-[3px] border-transparent"
                )}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#334155]">
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-gray-400 hover:text-white transition-colors px-2 py-1.5"
          >
            ログアウト
          </button>
        </div>
      </aside>
    </>
  );
}
