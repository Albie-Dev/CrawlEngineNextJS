"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Brain,
  CalendarDays,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Library,
  Megaphone,
  MessagesSquare,
  Music2,
  Puzzle,
  ScanSearch,
  Settings,
  Sparkles,
  Swords,
  Users,
  X,
  Youtube,
  Sun,
  Moon,
  Monitor
} from "lucide-react";
import { SyncDataButton } from "@/components/SyncDataButton";
import { GlobalSyncStatus } from "@/components/GlobalSyncStatus";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeContext";

type NavSection = {
  title: string;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
};

const navSections: NavSection[] = [
  {
    title: "📡 Thu thập dữ liệu",
    items: [
      { href: "/", label: "Dashboard tổng quan", icon: LayoutDashboard },
      { href: "/youtube", label: "YouTube Tracker", icon: Youtube },
      { href: "/tiktok", label: "TikTok Tracker", icon: Music2 },
      { href: "/facebook", label: "Facebook Tracker", icon: MessagesSquare }
    ]
  },
  {
    title: "🤖 Sản xuất nội dung",
    items: [
      // { href: "/content-gap", label: "Khoảng trống nội dung", icon: ScanSearch },
      { href: "/openai-test", label: "Prompt sản xuất nội dung", icon: Sparkles },
      { href: "/content", label: "Thư viện nội dung AI", icon: Library }
    ]
  },
  {
    title: "📊 Chiến lược & Tối ưu",
    items: [
      { href: "/recommendations", label: "Đề xuất chiến lược", icon: Brain },
      { href: "/viral-patterns", label: "Viral Patterns", icon: Megaphone },
      { href: "/query", label: "Hỏi đáp dữ liệu AI", icon: FlaskConical },
    ]
  },
  {
    title: "⚙️ Cấu hình",
    items: [
      { href: "/team", label: "Team & API Keys", icon: Users },
      { href: "/integrations", label: "Tích hợp & Webhook", icon: Puzzle },
      { href: "/settings", label: "Cấu hình nguồn dữ liệu", icon: Settings }
    ]
  }
];

const flatNavItems = navSections.flatMap((s) => s.items);

function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  
  return (
    <div className="flex items-center gap-1 rounded-lg border border-borderColor bg-bgTertiary p-1">
      <button
        onClick={() => setTheme("light")}
        className={cn(
          "rounded-md p-1.5 transition-all",
          theme === "light"
            ? "bg-bgSecondary text-kolia-green shadow-sm"
            : "text-textMuted hover:text-textPrimary"
        )}
        title="Giao diện Sáng"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={cn(
          "rounded-md p-1.5 transition-all",
          theme === "dark"
            ? "bg-bgSecondary text-kolia-green shadow-sm"
            : "text-textMuted hover:text-textPrimary"
        )}
        title="Giao diện Tối"
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={cn(
          "rounded-md p-1.5 transition-all",
          theme === "system"
            ? "bg-bgSecondary text-kolia-green shadow-sm"
            : "text-textMuted hover:text-textPrimary"
        )}
        title="Mặc định hệ thống"
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [quotaMsg, setQuotaMsg] = useState("");
  const [quotaDismissed, setQuotaDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/ai/verify")
      .then(r => r.json())
      .then(data => {
        if (data.exhausted) {
          setQuotaExhausted(true);
          setQuotaMsg(data.error || `⚠️ ${data.provider} đã hết hạn mức API.`);
        }
      })
      .catch(() => {});
  }, []);

  const showBanner = quotaExhausted && !quotaDismissed;

  return (
    <div className="min-h-screen bg-bgPrimary text-textPrimary transition-colors duration-200">
      {/* Quota warning banner */}
      {showBanner && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center gap-3 bg-red-600 px-4 py-2.5 text-sm text-white shadow-lg"
          style={{ height: 44 }}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="flex-1 text-sm font-medium">{quotaMsg}</p>
          <Link
            href="/settings"
            className="shrink-0 rounded bg-white dark:bg-slate-900/20 px-3 py-1 text-xs font-bold hover:bg-white dark:bg-slate-900/30 transition"
          >
            Settings
          </Link>
          <button onClick={() => setQuotaDismissed(true)} className="shrink-0 rounded p-1 hover:bg-white dark:bg-slate-900/20">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <GlobalSyncStatus />
      <header
        className="fixed inset-x-0 z-40 border-b border-borderColor bg-bgSecondary/90 backdrop-blur transition-all duration-200"
        style={{ top: showBanner ? 44 : 0 }}
      >
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-kolia-ink text-sm font-bold text-kolia-gold">
              KP
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold uppercase tracking-[0.16em] text-kolia-green">Kolia Phan</p>
              <h1 className="truncate text-base font-bold text-textPrimary md:text-lg">Kolia Competitor Tracker</h1>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeSelector />
            <SyncDataButton />
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto border-t border-borderColor px-4 py-2 md:hidden">
          {flatNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors",
                  active 
                    ? "bg-kolia-green text-white" 
                    : "text-textSecondary hover:bg-bgTertiary hover:text-textPrimary"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <aside
        className={cn(
          "fixed bottom-0 left-0 top-16 z-30 hidden border-r border-borderColor bg-bgSecondary/80 backdrop-blur transition-all duration-200 md:flex md:flex-col",
          collapsed ? "w-16" : "w-72"
        )}
      >
        {/* Scrollable nav area */}
        <div className={cn("flex-1 overflow-y-auto", collapsed ? "p-2" : "p-4")}>
          <nav className={collapsed ? "space-y-4" : "space-y-6"}>
            {navSections.map((section) => (
              <div key={section.title}>
                {!collapsed && (
                  <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-kolia-gold">
                    {section.title}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "group relative flex items-center rounded font-semibold transition-colors duration-150",
                          collapsed
                            ? "justify-center px-0 py-2.5 text-sm"
                            : "gap-3 px-3 py-2.5 text-sm",
                          active ? "bg-kolia-ink text-white shadow-soft" : "text-slate-600 dark:text-slate-400 hover:bg-kolia-mint dark:hover:bg-slate-800 hover:text-kolia-ink dark:hover:text-white"
                        )}
                      >
                        <Icon className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} />
                        {!collapsed && <span className="truncate">{item.label}</span>}

                        {/* Tooltip on hover when collapsed */}
                        {collapsed && (
                          <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 hidden whitespace-nowrap rounded bg-kolia-midnight px-2 py-1 text-[10px] font-bold text-white shadow-lg group-hover:block pointer-events-none">
                            {item.label}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {!collapsed && (
            <div className="mt-6 rounded border border-borderColor bg-gradient-to-br from-bgSecondary to-kolia-amber/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-kolia-gold">Nguyên tắc nội dung</p>
              <p className="mt-2 text-sm leading-6 text-textSecondary">
                Dashboard phục vụ nghiên cứu marketing, giữ tinh thần giáo dục, minh bạch và không đưa ra khuyến nghị đầu tư cá nhân.
              </p>
            </div>
          )}
        </div>

        {/* Toggle button - floating on the right edge */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-4 top-10 flex h-8 w-8 items-center justify-center rounded-full border border-borderColor bg-bgSecondary text-textSecondary shadow-sm hover:bg-bgTertiary hover:text-textPrimary transition-all"
          title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {collapsed ? (
              <path d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            )}
          </svg>
        </button>
      </aside>

      <main
        className={cn(
          "px-4 pb-10 md:px-8 transition-all duration-200",
          collapsed ? "md:ml-20" : "md:ml-72",
          showBanner ? "pt-[116px] md:pt-[108px]" : "pt-32 md:pt-24"
        )}
      >
        {children}
      </main>
    </div>
  );
}
