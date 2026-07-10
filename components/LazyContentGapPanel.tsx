"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, Database, Target, TrendingUp, ScanSearch } from "lucide-react";
import { ContentGapPanel } from "@/components/ContentGapPanel";
import type { Platform } from "@/lib/types";

type Props = {
  platform?: Platform;
  hasData?: boolean;
};

const LOADING_STEPS = [
  { icon: Database, label: "Đang truy xuất dữ liệu bài viết..." },
  { icon: Target, label: "Đang phân tích trụ cột nội dung..." },
  { icon: TrendingUp, label: "Đang đánh giá mức độ tương tác..." },
  { icon: ScanSearch, label: "AI đang dò tìm khoảng trống nội dung..." },
  { icon: Sparkles, label: "AI đang tổng hợp đề xuất chiến lược..." },
];

export function LazyContentGapPanel({ platform, hasData }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(hasData);
  const [stepIdx, setStepIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!hasData) {
      setLoading(false);
      return;
    }

    const startTime = Date.now();

    const stepTimer = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 4000);

    const elapsedTimer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const params = new URLSearchParams();
    if (platform) params.set("platform", platform);
    params.set("days", "90");

    fetch(`/api/content-gap?${params.toString()}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });

    return () => { clearInterval(stepTimer); clearInterval(elapsedTimer); };
  }, [platform, hasData]);

  if (!hasData) {
    return (
      <section className="rounded border border-kolia-line bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-kolia-ink">Content gap đối thủ trong nước</h2>
        <p className="mt-3 text-sm text-slate-500">Chưa có đủ dữ liệu đối thủ trong nước để phân tích.</p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="rounded border border-kolia-line bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-kolia-ink">Content gap đối thủ trong nước</h2>
        <p className="mt-1 text-sm text-slate-400">
          AI đang phân tích chiến lược nội dung...
        </p>
        <div className="mt-6 space-y-4">
          {LOADING_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === stepIdx;
            const isDone = i < stepIdx;
            return (
              <div key={i} className={`flex items-center gap-3 transition-opacity ${isActive ? "opacity-100" : isDone ? "opacity-60" : "opacity-30"}`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                  isDone ? "border-green-500 bg-green-50 text-green-600" : isActive ? "border-kolia-green bg-kolia-mint text-kolia-green" : "border-slate-200 bg-slate-50 text-slate-400"
                }`}>
                  {isDone ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <Icon className={`h-4 w-4 ${isActive ? "animate-bounce" : ""}`} />
                  )}
                </div>
                <p className={`text-sm ${isDone ? "text-green-700" : isActive ? "font-semibold text-kolia-ink" : "text-slate-400"}`}>
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

  if (error || !data?.domestic) {
    return (
      <section className="rounded border border-kolia-line bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-kolia-ink">Content gap đối thủ trong nước</h2>
        <p className="mt-3 text-sm text-red-500">Không thể tải dữ liệu content gap.</p>
      </section>
    );
  }

  return <ContentGapPanel domestic={data.domestic} />;
}
