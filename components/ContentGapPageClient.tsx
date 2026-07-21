"use client";

import { useEffect, useRef, useState } from "react";
import {
  Database,
  Loader2,
  RefreshCw,
  ScanSearch,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  ToggleLeft,
  ToggleRight,
  Info,
} from "lucide-react";
import { ContentGapPanel } from "@/components/ContentGapPanel";
import type { DomesticGapSnapshot } from "@/lib/contentGapSnapshot";

// ─── Loading progress ─────────────────────────────────────────────────────────

const GAP_STEPS = [
  { icon: Database, label: "Đang truy xuất dữ liệu bài viết..." },
  { icon: Target, label: "Đang phân tích trụ cột nội dung..." },
  { icon: TrendingUp, label: "Đang đánh giá mức độ tương tác..." },
  { icon: ScanSearch, label: "Đang dò tìm khoảng trống nội dung..." },
  { icon: Sparkles, label: "Đang tổng hợp kết quả..." },
];

function GapLoadingProgress() {
  const [stepIdx, setStepIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const stepStartRef = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setElapsed(Math.floor((now - startRef.current) / 1000));
      if (now - stepStartRef.current >= 4000) {
        setStepIdx((i) => Math.min(i + 1, GAP_STEPS.length - 1));
        stepStartRef.current = now;
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto max-w-lg py-16">
      <div className="rounded-2xl border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
        <div className="mb-8 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-kolia-mint">
            <ScanSearch className="h-8 w-8 text-kolia-green animate-pulse" />
          </div>
        </div>
        <p className="text-center text-sm font-semibold text-kolia-ink dark:text-slate-100 mb-6">
          Đang tổng hợp phân tích lần đầu...
        </p>
        <div className="space-y-4">
          {GAP_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === stepIdx;
            const isDone = i < stepIdx;
            return (
              <div
                key={i}
                className={`flex items-center gap-4 transition-opacity ${
                  isActive ? "opacity-100" : isDone ? "opacity-60" : "opacity-30"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
                    isDone
                      ? "border-green-500 dark:border-green-700 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                      : isActive
                      ? "border-kolia-green bg-kolia-mint dark:bg-emerald-900/40 text-kolia-green"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-400"
                  }`}
                >
                  {isDone ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <Icon className={`h-4 w-4 ${isActive ? "animate-bounce" : ""}`} />
                  )}
                </div>
                <p className={`text-sm font-medium ${isDone ? "text-green-700" : isActive ? "text-kolia-ink dark:text-slate-100" : "text-slate-400"}`}>
                  {step.label}
                </p>
                {isActive && <Loader2 className="ml-auto h-4 w-4 animate-spin text-kolia-green" />}
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">Đã chạy {elapsed}s</p>
      </div>
    </div>
  );
}

// ─── Auto refresh settings panel ──────────────────────────────────────────────

function AutoRefreshSettings({
  autoRefresh,
  onChange,
}: {
  autoRefresh: boolean;
  onChange: (v: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      await fetch("/api/content-gap/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoRefresh: !autoRefresh }),
      });
      onChange(!autoRefresh);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-kolia-ink dark:text-slate-100">Tự động cập nhật phân tích</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {autoRefresh ? (
              <>
                <span className="inline-flex items-center gap-1 font-medium text-kolia-green">
                  <span className="h-1.5 w-1.5 rounded-full bg-kolia-green inline-block animate-pulse" />
                  Đang bật
                </span>
                {" "}— Sau mỗi lần Sync dữ liệu hoàn tất, AI sẽ tự động tổng hợp lại phân tích
                Content Gap và lưu vào hệ thống. Lần vào trang sau sẽ đọc từ cache, không tốn
                thêm AI quota.
              </>
            ) : (
              <>
                <span className="font-medium text-slate-500 dark:text-slate-400">Đang tắt</span>
                {" "}— Phân tích sẽ không tự động cập nhật sau Sync. Bạn có thể bấm{" "}
                <span className="font-medium text-kolia-green">"Phân tích thủ công"</span> bên dưới
                để tạo snapshot mới bất kỳ lúc nào.
              </>
            )}
          </p>
          {autoRefresh && (
            <div className="mt-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-kolia-line dark:border-slate-800 px-3 py-2">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Lịch hoạt động:</span> Hook tự động
                chạy sau mỗi lần bấm{" "}
                <span className="font-semibold">Sync dữ liệu</span> trong bất kỳ trang nào. Để
                thiết lập sync tự động theo lịch (cron), vui lòng cấu hình trong môi trường server
                — tính năng scheduler sẽ được bổ sung trong phiên bản tiếp theo.
              </p>
            </div>
          )}
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className="mt-0.5 shrink-0 flex items-center gap-1.5 text-kolia-green hover:opacity-80 transition-opacity disabled:opacity-40"
          title={autoRefresh ? "Tắt tự động cập nhật" : "Bật tự động cập nhật"}
        >
          {saving ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : autoRefresh ? (
            <ToggleRight className="h-8 w-8" />
          ) : (
            <ToggleLeft className="h-8 w-8 text-slate-400" />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main page client ─────────────────────────────────────────────────────────

export function ContentGapPageClient() {
  const [domestic, setDomestic] = useState<DomesticGapSnapshot | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState(false);
  const [noData, setNoData] = useState(false);

  // Load snapshot
  useEffect(() => {
    fetch("/api/content-gap")
      .then((r) => r.json())
      .then((data) => {
        if (data.domestic) {
          setDomestic(data.domestic);
          setGeneratedAt(data.generatedAt);
          setLoading(false);
        } else if (data.message) {
          // Generating first time — poll
          setNoData(true);
          setLoading(false);
        } else {
          setError(true);
          setLoading(false);
        }
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });

    // Load auto-refresh setting
    fetch("/api/content-gap/settings")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.autoRefresh === "boolean") setAutoRefresh(d.autoRefresh);
      })
      .catch(() => {});
  }, []);

  // Manual generate
  async function handleManualGenerate() {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/content-gap", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        // Reload snapshot
        const snap = await fetch("/api/content-gap").then((r) => r.json());
        if (snap.domestic) {
          setDomestic(snap.domestic);
          setGeneratedAt(snap.generatedAt);
          setNoData(false);
        }
      }
    } finally {
      setIsGenerating(false);
    }
  }

  function formatAge(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (h >= 24) return `${Math.floor(h / 24)} ngày trước`;
    if (h > 0) return `${h} giờ ${m} phút trước`;
    return `${m} phút trước`;
  }

  if (loading) return <GapLoadingProgress />;

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-xl font-bold text-kolia-ink dark:text-slate-100">Content gap đối thủ trong nước</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Tìm cơ hội nội dung bằng cách phân tích các chủ đề top view từ kênh Việt Nam.
        </p>
        {generatedAt && (
          <p className="mt-1 text-xs text-slate-400">
            Cập nhật lần cuối:{" "}
            <span className="font-medium text-slate-500 dark:text-slate-400">{formatAge(generatedAt)}</span>
          </p>
        )}
      </div>

      {/* ── Settings panel ── */}
      <AutoRefreshSettings autoRefresh={autoRefresh} onChange={setAutoRefresh} />

      {/* ── Error states ── */}
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
          Không thể tải dữ liệu. Vui lòng thử lại hoặc bấm Phân tích thủ công.
        </div>
      )}

      {noData && (
        <div className="rounded-2xl border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-kolia-mint">
            <ScanSearch className="h-7 w-7 text-kolia-green" />
          </div>
          <p className="text-sm font-semibold text-kolia-ink dark:text-slate-100">Chưa có snapshot phân tích</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Hệ thống đang tổng hợp dữ liệu lần đầu, hoặc bạn có thể bấm Phân tích thủ công để
            tạo ngay.
          </p>
          <button
            onClick={handleManualGenerate}
            disabled={isGenerating}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-kolia-green px-5 py-2.5 text-sm font-semibold text-white hover:bg-kolia-green/90 disabled:opacity-60 transition-colors"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? "Đang phân tích..." : "Phân tích thủ công"}
          </button>
        </div>
      )}

      {/* ── Main content panel ── */}
      {domestic && (
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <ContentGapPanel domestic={domestic} />
        </div>
      )}

      {/* ── Manual refresh button (when data exists) ── */}
      {domestic && (
        <div className="flex items-center justify-between rounded-2xl border border-kolia-line dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">{domestic.stats.dataNote}</p>
          <button
            onClick={handleManualGenerate}
            disabled={isGenerating}
            className="ml-4 shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-kolia-green hover:bg-kolia-mint transition-colors disabled:opacity-60"
          >
            {isGenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {isGenerating ? "Đang phân tích..." : "Phân tích thủ công"}
          </button>
        </div>
      )}
    </div>
  );
}
