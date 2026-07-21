"use client";

import { useEffect, useState } from "react";
import { Database, Loader2, ScanSearch, Sparkles, Target, TrendingUp } from "lucide-react";
import { ContentGapPanel } from "@/components/ContentGapPanel";
import type { DomesticGapSnapshot } from "@/lib/contentGapSnapshot";
import type { Platform } from "@/lib/types";

type Props = {
  platform?: Platform;
  hasData?: boolean;
};

const LOADING_STEPS = [
  { icon: Database, label: "Đang tải dữ liệu content gap..." },
  { icon: Target, label: "Đang truy xuất snapshot..." },
  { icon: TrendingUp, label: "Đang xử lý dữ liệu..." },
];

export function LazyContentGapPanel({ platform, hasData }: Props) {
  const [data, setData] = useState<DomesticGapSnapshot | null>(null);
  const [loading, setLoading] = useState(hasData);
  const [stepIdx, setStepIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(false);
  const [noDataMsg, setNoDataMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!hasData) {
      setLoading(false);
      return;
    }

    const startTime = Date.now();

    const stepTimer = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 6000);

    const elapsedTimer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const params = new URLSearchParams();
    if (platform) params.set("platform", platform);
    params.set("source", "trong_nuoc");

    // Timeout safety: nếu API không trả về sau 15s, báo lỗi
    const timeoutId = setTimeout(() => {
      setNoDataMsg("API content gap không phản hồi. Vui lòng thử lại hoặc sync data.");
      setLoading(false);
    }, 15000);

    fetch(`/api/content-gap?${params.toString()}`)
      .then((r) => r.json())
      .then((res) => {
        clearTimeout(timeoutId);
        if (res.error) throw new Error(res.error);
        if (res.domestic) {
          setData(res.domestic);
        } else if (res.message) {
          setNoDataMsg(res.message);
        }
        setLoading(false);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        setError(true);
        setLoading(false);
      });

    return () => {
      clearInterval(stepTimer);
      clearInterval(elapsedTimer);
      clearTimeout(timeoutId);
    };
  }, [platform, hasData]);

  // ── No data ──
  if (!hasData) {
    return (
      <section className="rounded-2xl border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h2 className="text-base font-bold text-kolia-ink dark:text-slate-100">Content gap đối thủ trong nước</h2>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Chưa có đủ dữ liệu đối thủ trong nước để phân tích.
        </p>
      </section>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <section className="rounded-2xl border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h2 className="text-base font-bold text-kolia-ink dark:text-slate-100">Content gap đối thủ trong nước</h2>
        <p className="mt-1 text-sm text-slate-400">Đang tải dữ liệu content gap...</p>
        <div className="mt-6 space-y-4">
          {LOADING_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === stepIdx;
            const isDone = i < stepIdx;
            return (
              <div
                key={i}
                className={`flex items-center gap-3 transition-opacity ${
                  isActive ? "opacity-100" : isDone ? "opacity-60" : "opacity-30"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
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
                <p
                  className={`text-sm ${
                    isDone ? "text-green-700" : isActive ? "font-semibold text-kolia-ink dark:text-slate-100" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </p>
                {isActive && <Loader2 className="ml-auto h-4 w-4 animate-spin text-kolia-green" />}
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">Đã chạy {elapsed}s</p>
      </section>
    );
  }

  // ── Missing Snapshot ──
  if (noDataMsg && !data) {
    return (
      <section className="rounded-2xl border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm text-center py-10">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-kolia-mint">
          <ScanSearch className="h-7 w-7 text-kolia-green" />
        </div>
        <h2 className="text-base font-bold text-kolia-ink dark:text-slate-100">Chưa có snapshot Content Gap</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          {noDataMsg} Vui lòng truy cập trang Content Gap chính để xem tiến trình phân tích.
        </p>
        <a
          href="/content-gap"
          className="mt-4 inline-block rounded-xl bg-kolia-green px-5 py-2.5 text-sm font-semibold text-white hover:bg-kolia-green/90 transition-colors"
        >
          Đi đến Content Gap
        </a>
      </section>
    );
  }

  // ── Error ──
  if (error || !data) {
    return (
      <section className="rounded-2xl border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h2 className="text-base font-bold text-kolia-ink dark:text-slate-100">Content gap đối thủ trong nước</h2>
        <p className="mt-3 text-sm text-red-500">
          Không thể tải dữ liệu content gap. Đảm bảo bạn đã chạy migration database (`npx prisma migrate dev`) và Sync dữ liệu.
        </p>
      </section>
    );
  }

  // ── Data ──
  return (
    <section>
      <ContentGapPanel domestic={data} />
    </section>
  );
}
