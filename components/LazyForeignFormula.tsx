"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { ViralFormulaCard } from "@/components/ViralFormulaCard";

type ForeignFormula = {
  viralPatterns: string[];
  shortForm: any[];
  longForm: any[];
  koliaFormats: string[];
};

type LazyCardProps = {
  video: any;
  label: string;
};

function LazyVideoCard({ video, label }: LazyCardProps) {
  const [formula, setFormula] = useState(video);
  const [loading, setLoading] = useState(false);

  const analyze = useCallback(() => {
    if (loading || formula.formula !== "Nhấn 'Phân tích' để AI đánh giá") return;
    setLoading(true);
    const params = new URLSearchParams({
      title: video.title,
      format: video.format,
      mainTopic: video.mainTopic,
    });
    if (video.transcript) params.set("transcript", video.transcript.slice(0, 5000));
    fetch(`/api/analyze-video?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setFormula((prev: any) => ({ ...prev, ...data }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [loading, formula, video]);

  return (
    <div className="relative">
      <ViralFormulaCard formula={formula} label={label} />
      {formula.formula === "Nhấn 'Phân tích' để AI đánh giá" && (
        <button
          onClick={analyze}
          disabled={loading}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded border border-kolia-line bg-white px-4 py-2 text-sm font-semibold text-kolia-green hover:bg-kolia-mint transition disabled:opacity-50"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> AI đang phân tích...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Phân tích video này</>
          )}
        </button>
      )}
    </div>
  );
}
;

export function LazyForeignFormula({ hasData }: { hasData?: boolean }) {
  const [data, setData] = useState<ForeignFormula | null>(null);
  const [loading, setLoading] = useState(hasData ?? true);

  useEffect(() => {
    if (!hasData) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({ platform: "youtube", days: "365" });
    fetch(`/api/content-gap?${params.toString()}`)
      .then((r) => r.json())
      .then((res) => {
        setData(res.foreign ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [hasData]);

  if (!hasData) {
    return (
      <section className="rounded border border-kolia-line bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-kolia-ink">Cấu trúc nội dung tạo sức hút từ kênh nước ngoài</h2>
        <p className="mt-3 text-sm text-slate-500">Chưa có đủ dữ liệu từ đối thủ nước ngoài.</p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="rounded border border-kolia-line bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          AI đang phân tích cấu trúc nội dung nước ngoài...
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded border border-kolia-line bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-kolia-ink">Cấu trúc nội dung tạo sức hút từ kênh nước ngoài</h2>
        <p className="mt-3 text-sm text-slate-500">Chưa có đủ dữ liệu từ đối thủ nước ngoài.</p>
      </section>
    );
  }

  return (
    <section className="rounded border border-kolia-line bg-white p-5 shadow-sm">
      <details className="group" open>
        <summary className="flex cursor-pointer items-center justify-between gap-2 select-none">
          <h2 className="text-base font-bold text-kolia-ink">Kịch bản video & cấu trúc nội dung từ YouTube nước ngoài</h2>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 max-h-[600px] overflow-y-auto space-y-4 pr-1">
          <div className="rounded bg-kolia-mint px-4 py-3">
            <h3 className="text-sm font-bold text-kolia-green">Mô hình lan tỏa</h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-700">
              {data.viralPatterns.map((pattern) => (
                <li key={pattern} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-kolia-gold" />
                  {pattern}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {data.shortForm.slice(0, 2).map((formula: any) => (
              <LazyVideoCard key={formula.sourceUrl} video={formula} label="Video ngắn" />
            ))}
            {data.longForm.slice(0, 2).map((formula: any) => (
              <LazyVideoCard key={formula.sourceUrl} video={formula} label="Video phân tích dài" />
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}
