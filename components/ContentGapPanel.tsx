"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  ExternalLink,
  Globe,
  Hash,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  ChevronRight,
  Star,
} from "lucide-react";
import type {
  DomesticGapSnapshot,
  TopicDeepDetail,
  TopicDetail,
  TopicRow,
} from "@/lib/contentGapSnapshot";

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  trend,
  sublabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  trend: number;
  sublabel: string;
}) {
  const isUp = trend > 0;
  const isDown = trend < 0;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-100 bg-white p-5 transition-all hover:shadow-md hover:-translate-y-0.5">
      {/* Decorative gradient bar */}
      <div className={`absolute inset-x-0 top-0 h-1 ${iconBg.replace('bg-', 'bg-')} opacity-60`} />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
          <div className="mt-3 flex items-baseline gap-2.5">
            <span className="text-4xl font-extrabold text-kolia-ink leading-none tabular-nums">{value}</span>
            {trend === 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                Lần đầu
              </span>
            ) : (
              <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isUp
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-500"
              }`}>
                <svg className={`h-3 w-3 ${isDown ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 15l-6-6-6 6" />
                </svg>
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">{sublabel}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg} group-hover:scale-110 transition-transform`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

// ─── Priority badge ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: TopicRow["priority"] }) {
  const styles = {
    Cao: "bg-red-50 text-red-600",
    "Trung bình": "bg-orange-50 text-orange-500",
    Thấp: "bg-kolia-mint text-kolia-green",
  };
  return (
    <span className={`inline-flex items-center justify-center rounded px-2.5 py-0.5 text-[11px] font-bold ${styles[priority]}`}>
      {priority}
    </span>
  );
}

// ─── Format views ──────────────────────────────────────────────────────────────

function fv(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

// ─── Right panel: topic detail ─────────────────────────────────────────────────

function TopicDetailPanel({
  topic,
  onBack,
}: {
  topic: TopicRow;
  onBack: () => void;
}) {
  const router = useRouter();
  const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);
  const [deepDetail, setDeepDetail] = useState<TopicDeepDetail | undefined>(topic.deepDetail);
  const detail: TopicDetail | undefined = topic.detail;

  async function handleDeepAnalyze() {
    setIsDeepAnalyzing(true);
    try {
      const res = await fetch("/api/content-gap/deep-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicSlug: topic.slug }),
      });
      const data = await res.json();
      if (data.ok && data.deepDetail) {
        setDeepDetail(data.deepDetail);
      }
    } catch {
      // silent
    } finally {
      setIsDeepAnalyzing(false);
    }
  }

  const competitionColor =
    detail?.competitionLevel === "Thấp"
      ? "text-kolia-green"
      : detail?.competitionLevel === "Trung bình"
      ? "text-orange-500"
      : "text-red-500";

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-100 shadow-sm p-6 relative">
      {/* Back button (Mobile/Tablet) */}
      <button
        onClick={onBack}
        className="lg:hidden absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-6 uppercase tracking-wider">
        <ArrowLeft className="h-3 w-3" />
        Chi tiết chủ đề
      </div>

      <div className="flex items-start gap-4 mb-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-kolia-mint">
          <TrendingUp className="h-6 w-6 text-kolia-green" />
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <h3 className="text-xl font-bold text-kolia-ink leading-tight mb-2">{topic.name}</h3>
          {detail && (
            <div className="flex items-center gap-2">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  detail.badge === "Cơ hội cao"
                    ? "bg-kolia-mint text-kolia-green"
                    : detail.badge === "Cạnh tranh cao"
                    ? "bg-red-50 text-red-600"
                    : "bg-orange-50 text-orange-500"
                }`}
              >
                {detail.badge}
              </span>
              <p className="text-xs text-slate-500">{detail.tagline}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 divide-x divide-slate-100 border border-slate-100 rounded-xl py-4 mb-6">
        {[
          { label: "Số video", value: topic.videoCount },
          { label: "Số kênh", value: topic.channelCount },
          { label: "Trung vị lượt xem", value: fv(topic.medianViews) },
          { label: "Mức cạnh tranh", value: detail?.competitionLevel ?? topic.priority, colored: true },
        ].map(({ label, value, colored }, i) => (
          <div key={i} className="text-center px-2">
            <p className="text-[11px] text-slate-400 mb-1">{label}</p>
            <p className={`text-lg font-bold ${colored ? competitionColor : "text-kolia-ink"}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* AI suggestions */}
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-kolia-green" />
          <p className="text-sm font-bold text-kolia-ink">AI gợi ý</p>
        </div>

        <div className="space-y-5">
          {/* Các kênh đang làm */}
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 rounded-lg bg-kolia-mint items-center justify-center mt-0.5">
              <Users className="h-3.5 w-3.5 text-kolia-green" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Các kênh đang làm</p>
                {detail?.channels?.length ? (
                  <span className="bg-kolia-mint text-kolia-green text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {detail.channels.length} kênh
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {detail?.channels?.length ? detail.channels.join(", ") + "..." : "Chưa có dữ liệu"}
              </p>
            </div>
          </div>

          {/* Hook phổ biến */}
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 rounded-lg bg-kolia-mint items-center justify-center mt-0.5">
              <Hash className="h-3.5 w-3.5 text-kolia-green" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Hook phổ biến</p>
                {detail?.hooks?.length ? (
                  <span className="bg-kolia-mint text-kolia-green text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {detail.hooks.length} hook
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {detail?.hooks?.length ? detail.hooks.map((h) => `"${h}"`).join(", ") + "..." : "Chưa có dữ liệu"}
              </p>
            </div>
          </div>

          {/* Góc nội dung còn trống */}
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 rounded-lg bg-kolia-mint items-center justify-center mt-0.5">
              <BookOpen className="h-3.5 w-3.5 text-kolia-green" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Góc nội dung còn trống</p>
                {detail?.contentAngles?.length ? (
                  <span className="bg-kolia-mint text-kolia-green text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {detail.contentAngles.length} góc
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {detail?.contentAngles?.length ? detail.contentAngles.join(", ") : "Chưa có gợi ý"}
              </p>
            </div>
          </div>
        </div>

        {/* Deep analysis result */}
        {deepDetail && (
          <div className="rounded-xl border border-kolia-green/20 bg-kolia-mint/30 p-4 space-y-3 mt-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-kolia-green" />
              <p className="text-xs font-bold text-kolia-green uppercase tracking-widest">
                Phân tích sâu
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                  Tổng quan
                </p>
                <p className="text-xs text-slate-700 leading-relaxed">{deepDetail.summary}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                  Cơ hội
                </p>
                <p className="text-xs text-slate-700 leading-relaxed">{deepDetail.opportunity}</p>
              </div>
              {deepDetail.risks?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                    Rủi ro
                  </p>
                  <ul className="space-y-1 mt-1">
                    {deepDetail.risks.map((r, i) => (
                      <li key={i} className="flex gap-2 text-xs text-slate-600">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {deepDetail.tactics?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                    Chiến thuật
                  </p>
                  <ul className="space-y-1 mt-1">
                    {deepDetail.tactics.map((t, i) => (
                      <li key={i} className="flex gap-2 text-xs text-slate-600">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-kolia-green" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Deep analyze button */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          {!deepDetail ? (
            <button
              onClick={handleDeepAnalyze}
              disabled={isDeepAnalyzing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-kolia-green px-4 py-2.5 text-sm font-semibold text-white hover:bg-kolia-green/90 disabled:opacity-60 transition-colors"
            >
              {isDeepAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang phân tích...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Phân tích sâu hơn
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleDeepAnalyze}
              disabled={isDeepAnalyzing}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              {isDeepAnalyzing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Làm mới phân tích
            </button>
          )}
        </div>
      </div>

      {/* International note */}
      {detail?.internationalNote && (
        <div className="flex items-center gap-3 rounded-xl bg-[#F4FBFA] border border-[#E6F4F1] px-4 py-3 mt-6">
          <Globe className="h-5 w-5 shrink-0 text-kolia-green" />
          <p className="flex-1 text-xs text-slate-600 leading-relaxed">
            {detail.internationalNote}
          </p>
          <button
            onClick={() => router.push(`/youtube?source=nuoc_ngoai&search=${encodeURIComponent(topic.name)}`)}
            className="shrink-0 rounded bg-white border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1"
          >
            Xem nguồn quốc tế
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Category section header ──────────────────────────────────────────────────

const CATEGORY_META = [
  {
    key: "commonTopics" as const,
    num: 1,
    title: "Họ đang nói nhiều về",
    iconColor: "text-blue-500",
  },
  {
    key: "repeatedTopics" as const,
    num: 2,
    title: "Chủ đề bị lặp lại",
    iconColor: "text-blue-500",
  },
  {
    key: "underusedHighEngagement" as const,
    num: 3,
    title: "Tương tác tốt nhưng ít bên làm",
    iconColor: "text-kolia-green",
  },
  {
    key: "gaps" as const,
    num: 4,
    title: "Khoảng trống Kolia có thể nhảy vào",
    iconColor: "text-kolia-green",
  },
];

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ContentGapPanel({ domestic }: { domestic: DomesticGapSnapshot }) {
  const [selectedTopic, setSelectedTopic] = useState<TopicRow | null>(null);

  // Group generic icons by index to alternate them like in the design if desired
  // The design uses Globe, BarChart, Book. We'll alternate them based on row index.
  const rowIcons = [Globe, BarChart2, BookOpen, Lightbulb];

  return (
    <div className="space-y-6 bg-white">
      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Star}
          iconBg="bg-kolia-mint"
          iconColor="text-kolia-green"
          label="Chủ đề nổi bật"
          value={domestic.stats.notableTopics}
          trend={domestic.stats.notableTopicsTrend}
          sublabel="Xu hướng tăng trong 30 ngày"
        />
        <StatCard
          icon={RefreshCw}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
          label="Chủ đề lặp lại"
          value={domestic.stats.repeatedTopics}
          trend={domestic.stats.repeatedTopicsTrend}
          sublabel="Nhiều kênh cùng khai thác"
        />
        <StatCard
          icon={Target}
          iconBg="bg-kolia-mint"
          iconColor="text-kolia-green"
          label="Khoảng trống phù hợp"
          value={domestic.stats.gaps}
          trend={domestic.stats.gapsTrend}
          sublabel="Ít cạnh tranh, tiềm năng cao"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px] h-full min-h-[600px]">
      {/* ── Left: topic list ── */}
      <div className="overflow-y-auto pr-0 lg:pr-2">
        <div className="space-y-8">
          {CATEGORY_META.map((cat) => {
            const topics = domestic[cat.key];
            if (!topics?.length) return null;

            return (
              <div key={cat.key}>
                {/* Section header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-kolia-green text-xs font-bold text-white">
                      {cat.num}
                    </span>
                    <span className="text-[15px] font-bold text-kolia-ink">{cat.title}</span>
                  </div>
                  <button className="text-[11px] font-semibold text-slate-400 hover:text-slate-600">
                    Xem tất cả
                  </button>
                </div>

                {/* Table */}
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="pb-3 pl-3 pr-2 text-left text-[11px] font-semibold text-slate-400 font-medium w-1/2">
                        Chủ đề
                      </th>
                      <th className="pb-3 px-2 text-center text-[11px] font-semibold text-slate-400 font-medium">
                        Số video
                      </th>
                      <th className="pb-3 px-2 text-center text-[11px] font-semibold text-slate-400 font-medium">
                        Số kênh
                      </th>
                      <th className="pb-3 px-3 text-center text-[11px] font-semibold text-slate-400 font-medium whitespace-nowrap">
                        Trung vị lượt xem
                      </th>
                      <th className="pb-3 pl-2 pr-4 text-right text-[11px] font-semibold text-slate-400 font-medium whitespace-nowrap">
                        Ưu tiên
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topics.slice(0, 4).map((topic, i) => {
                      const RowIcon = rowIcons[i % rowIcons.length];
                      const isSelected = selectedTopic?.slug === topic.slug;
                      return (
                        <tr
                          key={topic.slug}
                          onClick={() => setSelectedTopic(isSelected ? null : topic)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? "bg-slate-50" : "hover:bg-slate-50/50"
                          }`}
                        >
                          <td className="py-3 pl-3 pr-2">
                            <div className="flex items-center gap-3">
                              <RowIcon className={`h-4 w-4 ${cat.iconColor}`} />
                              <span className="text-[13px] font-semibold text-slate-700 leading-tight">
                                {topic.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center text-[13px] font-medium text-slate-600">
                            {topic.videoCount}
                          </td>
                          <td className="py-3 px-2 text-center text-[13px] font-medium text-slate-600">
                            {topic.channelCount}
                          </td>
                          <td className="py-3 px-2 text-center text-[13px] font-medium text-slate-600">
                            {fv(topic.medianViews)}
                          </td>
                          <td className="py-3 pl-2 pr-4 text-right whitespace-nowrap">
                            <PriorityBadge priority={topic.priority} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* Data note */}
        <div className="flex items-center gap-2 mt-8 py-3 border-t border-slate-100">
          <div className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-400">
            i
          </div>
          <p className="text-[11px] text-slate-400">{domestic.stats.dataNote}</p>
        </div>
      </div>

      {/* ── Right: detail panel ── */}
      <div className="hidden lg:block h-[calc(100vh-140px)] sticky top-6">
        {selectedTopic ? (
          <TopicDetailPanel
            key={selectedTopic.slug}
            topic={selectedTopic}
            onBack={() => setSelectedTopic(null)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center py-12 rounded-2xl border border-slate-100 bg-slate-50/50">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <TrendingUp className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">Chi tiết chủ đề</p>
              <p className="mt-1 text-xs text-slate-400 max-w-[180px]">
                Chọn một chủ đề bên trái để xem phân tích AI và gợi ý nội dung
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: detail as modal-like bottom section */}
      {selectedTopic && (
        <div className="lg:hidden mt-4">
          <TopicDetailPanel
            key={selectedTopic.slug}
            topic={selectedTopic}
            onBack={() => setSelectedTopic(null)}
          />
        </div>
      )}
    </div>
    </div>
  );
}
