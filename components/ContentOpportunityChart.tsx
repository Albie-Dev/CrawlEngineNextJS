"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  ChevronDown,
  Info,
  ExternalLink,
  Eye,
  Play,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ChevronRight,
  X,
  SlidersHorizontal,
  LayoutGrid,
} from "lucide-react";
import type { TopicRow, TopicVideo } from "@/lib/contentGapSnapshot";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fv(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function fvLong(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} triệu`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} nghìn`;
  return String(n);
}

function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function safeNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && isFinite(v) ? v : fallback;
}

function safeArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Quadrant model
// ─────────────────────────────────────────────────────────────────────────────

type QuadrantId = "opportunity" | "differentiate" | "watch" | "avoid";

function getQuadrant(x: number, y: number, midX: number, midY: number): QuadrantId {
  if (y >= midY && x < midX) return "opportunity";
  if (y >= midY && x >= midX) return "differentiate";
  if (y < midY && x < midX) return "watch";
  return "avoid";
}

const QUADRANT_META: Record<
  QuadrantId,
  { label: string; sub: string; color: string; wash: string }
> = {
  opportunity: {
    label: "Cơ hội ưu tiên",
    sub: "Nhu cầu cao · Cạnh tranh thấp",
    color: "#0F8C6F",
    wash: "rgba(15,140,111,0.06)",
  },
  differentiate: {
    label: "Cần tạo khác biệt",
    sub: "Nhu cầu cao · Cạnh tranh cao",
    color: "#3B5BFD",
    wash: "rgba(59,91,253,0.05)",
  },
  watch: {
    label: "Theo dõi thêm",
    sub: "Nhu cầu thấp · Cạnh tranh thấp",
    color: "#8891A5",
    wash: "rgba(136,145,165,0.05)",
  },
  avoid: {
    label: "Không ưu tiên",
    sub: "Nhu cầu thấp · Cạnh tranh cao",
    color: "#E24C4C",
    wash: "rgba(226,76,76,0.05)",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Growth model
// ─────────────────────────────────────────────────────────────────────────────

function growthColor(rate: number): string {
  if (rate > 15) return "#0F8C6F";
  if (rate >= -15) return "#D48806";
  return "#E24C4C";
}

type GrowthInfo = { label: string; color: string; icon: "up" | "flat" | "down"; numStr: string };
function growthInfo(rate: number): GrowthInfo {
  if (rate > 15) return { label: "Tăng mạnh", color: "#0F8C6F", icon: "up", numStr: `+${rate}%` };
  if (rate >= -15)
    return { label: "Ổn định", color: "#D48806", icon: "flat", numStr: `${rate >= 0 ? "+" : ""}${rate}%` };
  return { label: "Giảm", color: "#E24C4C", icon: "down", numStr: `${rate}%` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bubble scale
// ─────────────────────────────────────────────────────────────────────────────

function bubbleRadius(totalViews: number, maxViews: number): number {
  const minR = 8;
  const maxR = 25;
  if (maxViews === 0) return minR;
  const ratio = Math.sqrt(totalViews / maxViews);
  return Math.round(minR + ratio * (maxR - minR));
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type YMetric = "outlierRate" | "medianViews";
type XMetric = "competitionScore" | "videoCount";

interface BubblePoint {
  x: number;
  y: number;
  z: number;
  r: number;
  topic: TopicRow;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scatter bubble
// ─────────────────────────────────────────────────────────────────────────────

interface ScatterShapeProps {
  cx?: number;
  cy?: number;
  payload?: BubblePoint;
  onHover: (p: BubblePoint | null, cx: number, cy: number) => void;
  onSelect: (p: BubblePoint) => void;
  selectedSlug: string | null;
}

function BubbleDot({ cx = 0, cy = 0, payload, onHover, onSelect, selectedSlug }: ScatterShapeProps) {
  if (!payload) return null;
  const r = payload.r;
  const color = growthColor(safeNum(payload.topic.growthRate30d));
  const isSelected = selectedSlug === payload.topic.slug;

  return (
    <g
      style={{ cursor: "pointer" }}
      onMouseEnter={() => onHover(payload, cx, cy)}
      onMouseLeave={() => onHover(null, 0, 0)}
      onClick={() => onSelect(payload)}
      tabIndex={0}
      role="button"
      aria-label={payload.topic.name}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(payload);
      }}
    >
      {isSelected && (
        <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="2 3" opacity={0.5} />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={r + (isSelected ? 3 : 0)}
        fill={color}
        fillOpacity={isSelected ? 0.94 : 0.78}
        stroke="#fff"
        strokeWidth={isSelected ? 2.5 : 1.5}
      />
      {r >= 17 && (
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={8}
          fill="#fff"
          fontWeight={700}
          pointerEvents="none"
          style={{ userSelect: "none" }}
        >
          {payload.topic.name.length > 9 ? payload.topic.name.slice(0, 8) + "…" : payload.topic.name}
        </text>
      )}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating tooltip
// ─────────────────────────────────────────────────────────────────────────────

function BubbleTooltip({
  point,
  chartX,
  chartY,
  containerW,
}: {
  point: BubblePoint;
  chartX: number;
  chartY: number;
  containerW: number;
}) {
  const topic = point.topic;
  const gi = growthInfo(safeNum(topic.growthRate30d));
  const flipLeft = chartX > containerW - 240;

  return (
    <div
      className="pointer-events-none absolute z-50 min-w-[216px] rounded-2xl border border-slate-200 dark:border-slate-800/70 bg-white dark:bg-slate-900/95 p-4 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.18)] backdrop-blur-sm"
      style={{
        top: Math.max(0, chartY - 10),
        left: flipLeft ? chartX - 226 : chartX + 16,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p className="font-bold text-slate-900 dark:text-slate-100 text-[13px] leading-snug">{topic.name}</p>
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
          style={{ background: gi.color + "18", color: gi.color }}
        >
          {gi.numStr}
        </span>
      </div>
      <div className="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        {[
          ["Số video", topic.videoCount],
          ["Số kênh", topic.channelCount],
          ["Tổng lượt xem", fv(safeNum(topic.totalViews))],
          ["Trung vị lượt xem", fv(topic.medianViews)],
          ["Tỷ lệ tương tác", pct(safeNum(topic.avgEngagement))],
          ["Tỷ lệ video outlier", pct(safeNum(topic.outlierRate))],
        ].map(([k, v]) => (
          <div key={String(k)} className="flex justify-between gap-4 tabular-nums">
            <span>{k}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{v}</span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-400">
        Click để xem danh sách video
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail sidebar
// ─────────────────────────────────────────────────────────────────────────────

function GrowthIcon({ icon }: { icon: "up" | "flat" | "down" }) {
  if (icon === "up") return <TrendingUp className="h-3 w-3" />;
  if (icon === "down") return <TrendingDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
}

function VideoRow({ video, index, onClick }: { video: TopicVideo; index: number; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 px-1.5 py-1.5 transition-colors group cursor-pointer"
    >
      <span className="text-[10px] font-semibold text-slate-300 w-4 shrink-0 text-center tabular-nums">
        {index}
      </span>
      {video.thumbnailUrl ? (
        <div className="relative shrink-0 rounded-lg overflow-hidden w-12 h-8 bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="shrink-0 rounded-lg w-12 h-8 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <Play className="h-3 w-3 text-slate-300" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate leading-tight">{video.title}</p>
        <p className="text-[10px] text-slate-400 truncate">{video.channelName}</p>
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{fv(video.views)}</p>
        <p className="text-[10px] text-slate-400">{pct(video.engagementRate)}</p>
      </div>
      {video.youtubeId && (
        <a
          href={`https://youtube.com/watch?v=${video.youtubeId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:text-slate-400 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kolia-green/40 rounded"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function TopicDetailSidebar({
  topic,
  onClose,
  onOpenVideoModal,
  onOpenVideo,
}: {
  topic: TopicRow;
  onClose: () => void;
  onOpenVideoModal: () => void;
  onOpenVideo: (v: TopicVideo) => void;
}) {
  const gi = growthInfo(safeNum(topic.growthRate30d));
  const videos = safeArr<TopicVideo>(topic.sampleVideos);
  const quadrant =
    topic.priority === "Cao"
      ? QUADRANT_META.opportunity
      : topic.priority === "Trung bình"
      ? QUADRANT_META.differentiate
      : QUADRANT_META.watch;

  const reliabilityLabel = topic.videoCount >= 10 ? "Cao" : topic.videoCount >= 5 ? "Trung bình" : "Thấp";
  const reliabilityColor = topic.videoCount >= 10 ? "#0F8C6F" : topic.videoCount >= 5 ? "#D48806" : "#E24C4C";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3.5 shrink-0">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
          style={{ background: quadrant.color + "14", color: quadrant.color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: quadrant.color }} />
          {quadrant.label}
        </span>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kolia-green/40"
          aria-label="Đóng chi tiết"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 mb-3.5 shrink-0 leading-snug tracking-tight">
        {topic.name}
      </h3>

      <div className="shrink-0 mb-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          Chỉ số chủ đề
        </p>
        {(
          [
            ["Số video", topic.videoCount],
            ["Số kênh", topic.channelCount],
            ["Tổng lượt xem", fvLong(safeNum(topic.totalViews))],
            ["Trung vị lượt xem", `${fv(topic.medianViews)}`],
            ["Tỷ lệ tương tác", pct(safeNum(topic.avgEngagement))],
            ["Tỷ lệ video outlier", pct(safeNum(topic.outlierRate))],
          ] as [string, string | number][]
        ).map(([k, v]) => (
          <div key={k} className="flex justify-between text-[12px] tabular-nums">
            <span className="text-slate-500 dark:text-slate-400">{k}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{v}</span>
          </div>
        ))}
        <div className="flex justify-between text-[12px]">
          <span className="text-slate-500 dark:text-slate-400">Xu hướng 30 ngày</span>
          <span className="font-semibold flex items-center gap-1 tabular-nums" style={{ color: gi.color }}>
            <GrowthIcon icon={gi.icon} />
            {gi.numStr}
          </span>
        </div>
        <div className="flex justify-between text-[12px] pt-2 border-t border-slate-200 dark:border-slate-800/70">
          <span className="text-slate-500 dark:text-slate-400">Mức phù hợp với kênh</span>
          <span className="font-bold text-kolia-green">
            {topic.priority === "Cao" ? "Cao" : topic.priority === "Trung bình" ? "Trung bình" : "Thấp"}
          </span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="text-slate-500 dark:text-slate-400">Độ tin cậy</span>
          <span className="font-bold" style={{ color: reliabilityColor }}>
            {reliabilityLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2 shrink-0">
        <p className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300">Video nguồn tạo nên chủ đề</p>
        <p className="text-[10px] font-medium text-slate-400 tabular-nums">{videos.length} video</p>
      </div>
      <div className="shrink-0 grid grid-cols-[20px_1fr_auto] gap-1 px-1.5 pb-2 border-b border-slate-100 dark:border-slate-800/60">
        <span className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wide">#</span>
        <span className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wide">Video</span>
        <span className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wide text-right">
          Xem / Tương tác
        </span>
      </div>
      <div className="overflow-y-auto space-y-0.5 mt-1 pr-0.5 max-h-[200px]">
        {videos.length > 0 ? (
          videos.map((v, i) => (
            <VideoRow key={v.id} video={v} index={i + 1} onClick={() => onOpenVideo(v)} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-xs gap-2">
            <Eye className="h-5 w-5 opacity-30" />
            Chưa có dữ liệu video
          </div>
        )}
      </div>

      {videos.length > 0 && (
        <button
          onClick={onOpenVideoModal}
          className="mt-3 shrink-0 w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 text-[12px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:border-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kolia-green/40"
        >
          Xem tất cả video gốc
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {topic.videoCount < 5 && (
        <div className="mt-3 shrink-0 flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50 p-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-amber-700">Mẫu nhỏ: {topic.videoCount} video</p>
            <p className="text-[10px] text-amber-600 leading-snug">
              Độ tin cậy thấp — không nên kết luận mạnh khi dữ liệu quá ít.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Legend / how-to-read panel
// ─────────────────────────────────────────────────────────────────────────────

function HowToReadPanel() {
  return (
    <div className="rounded-2xl border border-borderColor bg-bgSecondary p-4 h-full flex flex-col">
      <div className="flex items-center gap-1.5 mb-3.5 shrink-0">
        <Info className="h-3.5 w-3.5 text-slate-400" />
        <p className="text-[12px] font-bold text-slate-700 dark:text-slate-300">Cách đọc biểu đồ</p>
      </div>

      <div className="mb-4 shrink-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
          Kích thước bong bóng
        </p>
        <div className="flex items-end gap-4">
          {[
            { label: "Thấp\n(<100K)", r: 8 },
            { label: "Trung bình\n(100K–1M)", r: 14 },
            { label: "Cao\n(>1M)", r: 21 },
          ].map(({ label, r }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div className="rounded-full bg-slate-300 shrink-0" style={{ width: r * 2, height: r * 2 }} />
              <p className="text-[9px] text-slate-400 text-center whitespace-pre-line leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4 shrink-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Tốc độ tăng trưởng 30 ngày
        </p>
        <div className="space-y-1.5">
          {[
            { color: "#0F8C6F", label: "Tăng mạnh", sub: "(>+15%)" },
            { color: "#D48806", label: "Ổn định", sub: "(-15% đến +15%)" },
            { color: "#E24C4C", label: "Giảm", sub: "(<-15%)" },
          ].map(({ color, label, sub }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">{label}</span>
              <span className="text-[10px] text-slate-400">{sub}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 border-t border-slate-100 dark:border-slate-800/60 pt-3.5">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
          Gợi ý đọc nhanh
        </p>
        <div className="space-y-2.5">
          {(Object.entries(QUADRANT_META) as [QuadrantId, (typeof QUADRANT_META)[QuadrantId]][]).map(
            ([key, meta]) => (
              <div key={key} className="flex items-start gap-2">
                <div className="h-2.5 w-2.5 rounded-full shrink-0 mt-0.5" style={{ background: meta.color }} />
                <div>
                  <span className="text-[11px] font-semibold" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                  <br />
                  <span className="text-[9px] text-slate-400">{meta.sub}</span>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <div className="mt-3.5 shrink-0 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-2.5">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[10px] font-bold text-amber-700">Mẫu nhỏ &lt; 5 video</p>
          <p className="text-[10px] text-amber-600 leading-snug">
            Độ tin cậy thấp — không nên kết luận mạnh.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  topics?: TopicRow[];
  data?: TopicRow[];
}

export function ContentOpportunityChart({ topics, data }: Props) {
  topics = topics ?? data ?? [];
  const [yMetric, setYMetric] = useState<YMetric>("outlierRate");
  const [xMetric, setXMetric] = useState<XMetric>("competitionScore");
  const [filterEnabled, setFilterEnabled] = useState(true);
  const [timeframe, setTimeframe] = useState<string>("30");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<BubblePoint | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<TopicVideo | null>(null);
  const [mobileLegendOpen, setMobileLegendOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const MIN_VIDEOS = 5;
  const MIN_CHANNELS = 3;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setVideoModalOpen(false);
        setSelectedVideo(null);
      }
    }
    if (videoModalOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [videoModalOpen]);

  const filtered = topics.filter((t) => {
    if (filterEnabled && (t.videoCount < MIN_VIDEOS || t.channelCount < MIN_CHANNELS)) return false;
    if (timeframe !== "all" && t.sampleVideos && t.sampleVideos.length > 0) {
      const days = parseInt(timeframe, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const hasRecent = t.sampleVideos.some((v) => new Date(v.publishedAt) >= cutoff);
      if (!hasRecent) return false;
    }
    return true;
  });

  function getX(t: TopicRow): number {
    const raw =
      xMetric === "competitionScore"
        ? safeNum(t.competitionScore, t.channelCount > 0 ? t.videoCount / t.channelCount : t.videoCount)
        : t.videoCount;
    return Math.max(0.1, raw);
  }

  function getY(t: TopicRow): number {
    if (yMetric === "outlierRate") return Math.round(safeNum(t.outlierRate) * 1000) / 10;
    return t.medianViews;
  }

  const maxTotalViews = Math.max(...filtered.map((t) => safeNum(t.totalViews)), 1);

  const xValues = filtered.map(getX);
  const yValues = filtered.map(getY);
  const midX = xValues.length ? (Math.min(...xValues) + Math.max(...xValues)) / 2 : 1;
  const midY = yValues.length ? (Math.min(...yValues) + Math.max(...yValues)) / 2 : 15;

  const points: BubblePoint[] = filtered.map((t) => ({
    x: getX(t),
    y: getY(t),
    z: 1,
    r: bubbleRadius(safeNum(t.totalViews), maxTotalViews),
    topic: t,
  }));

  const opportunityCount = useMemo(
    () => points.filter((p) => getQuadrant(p.x, p.y, midX, midY) === "opportunity").length,
    [points, midX, midY]
  );

  const selectedTopic = selectedSlug ? filtered.find((t) => t.slug === selectedSlug) ?? null : null;

  const handleHover = useCallback((p: BubblePoint | null, cx: number, cy: number) => {
    setHoveredPoint(p);
    if (p) setHoverPos({ x: cx, y: cy });
  }, []);

  const handleSelect = useCallback((p: BubblePoint) => {
    setSelectedSlug((prev) => (prev === p.topic.slug ? null : p.topic.slug));
    setHoveredPoint(null);
  }, []);

  const yLabel =
    yMetric === "outlierRate" ? "Hiệu suất chủ đề (tỷ lệ video outlier %)" : "Hiệu suất chủ đề (trung vị lượt xem)";

  const xLabel =
    xMetric === "competitionScore"
      ? "Mức cạnh tranh (# video / # kênh đang làm chủ đề)"
      : "Mức cạnh tranh (# video đang làm chủ đề)";

  const containerW = containerRef.current?.clientWidth ?? 600;

  return (
    <section className="rounded-2xl border border-borderColor bg-bgSecondary overflow-hidden">
      {/* ── Header / Toolbar ───────────────────────────────────────────── */}
      <div className="border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900">
        <div className="flex flex-col gap-5 p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950 px-4 py-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-kolia-mint dark:bg-emerald-900/40 text-kolia-green">
                  <LayoutGrid className="h-3.5 w-3.5" />
                </span>
                <h2 className="text-lg lg:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Ma trận cơ hội nội dung
                </h2>
              </div>
              <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                So sánh nhu cầu khán giả và mức độ cạnh tranh giữa các chủ đề để tìm khoảng trống nội dung.
              </p>
            </div>

            <div className="flex items-stretch shrink-0 rounded-xl border border-borderColor bg-bgSecondary overflow-hidden self-start lg:self-auto">
              <div className="flex flex-col justify-center gap-0.5 px-4 py-2 bg-kolia-mint/50 dark:bg-emerald-900/30">
                <p className="text-[9.5px] font-semibold text-kolia-green/80 uppercase tracking-wider whitespace-nowrap">
                  Cơ hội ưu tiên
                </p>
                <p className="text-[17px] font-extrabold text-kolia-green leading-tight tabular-nums">
                  {opportunityCount}
                </p>
              </div>
              <div className="w-px bg-borderColor" />
              <div className="flex flex-col justify-center gap-0.5 px-4 py-2">
                <p className="text-[9.5px] font-semibold text-textMuted uppercase tracking-wider whitespace-nowrap">
                  Tổng chủ đề
                </p>
                <p className="text-[17px] font-extrabold text-textPrimary leading-tight tabular-nums">
                  {filtered.length}
                </p>
              </div>
            </div>
          </div>

          {/* Axis legend chips + Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-textSecondary">
              <div className="flex items-center gap-1.5 bg-bgTertiary border border-borderColor rounded-lg px-2.5 py-1.5">
                <span className="font-semibold text-textPrimary">Trục X</span>
                <span className="text-textMuted">·</span>
                <span>Mức cạnh tranh</span>
              </div>
              <div className="flex items-center gap-1.5 bg-bgTertiary border border-borderColor rounded-lg px-2.5 py-1.5">
                <span className="font-semibold text-textPrimary">Trục Y</span>
                <span className="text-textMuted">·</span>
                <span>Hiệu suất</span>
              </div>
              <div className="flex items-center gap-1.5 bg-bgTertiary border border-borderColor rounded-lg px-2.5 py-1.5">
                <div className="flex items-center gap-0.5 opacity-70">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                </div>
                <span className="font-semibold text-textPrimary">Kích thước</span>
                <span className="text-textMuted">·</span>
                <span>Tổng lượt xem</span>
              </div>
              <div className="flex items-center gap-1.5 bg-bgTertiary border border-borderColor rounded-lg px-2.5 py-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-rose-500 via-amber-400 to-emerald-500" />
                <span className="font-semibold text-textPrimary">Màu sắc</span>
                <span className="text-textMuted">·</span>
                <span>Độ tăng trưởng</span>
              </div>
              <button
                onClick={() => setMobileLegendOpen((v) => !v)}
                className="xl:hidden ml-auto flex items-center gap-1 rounded-lg border border-borderColor px-2.5 py-1.5 font-semibold text-textSecondary hover:bg-bgTertiary"
              >
                Chú giải
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mobileLegendOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1 rounded-xl border border-borderColor bg-bgSecondary p-1">
                <div className="flex items-center gap-1 px-2">
                  <span className="text-[9.5px] font-bold text-textMuted uppercase tracking-wider">Y</span>
                  {(["outlierRate", "medianViews"] as YMetric[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => setYMetric(key)}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kolia-green/40 ${
                        yMetric === key ? "bg-kolia-ink text-white shadow-sm" : "text-textSecondary hover:text-textPrimary"
                      }`}
                    >
                      {key === "outlierRate" ? "Tỷ lệ outlier" : "Trung vị views"}
                    </button>
                  ))}
                </div>
                <div className="w-px h-6 bg-borderColor" />
                <div className="flex items-center gap-1 px-2">
                  <span className="text-[9.5px] font-bold text-textMuted uppercase tracking-wider">X</span>
                  {(["competitionScore", "videoCount"] as XMetric[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => setXMetric(key)}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kolia-green/40 ${
                        xMetric === key ? "bg-kolia-ink text-white shadow-sm" : "text-textSecondary hover:text-textPrimary"
                      }`}
                    >
                      {key === "competitionScore" ? "Cạnh tranh" : "Số video"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-borderColor bg-bgSecondary p-1">
                {["30", "60", "90"].map((days) => (
                  <button
                    key={days}
                    onClick={() => setTimeframe(days)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kolia-green/40 ${
                      timeframe === days ? "bg-kolia-ink text-white shadow-sm" : "text-textSecondary hover:text-textPrimary"
                    }`}
                  >
                    {days} ngày
                  </button>
                ))}
              </div>

              <label
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 cursor-pointer select-none transition ${
                  filterEnabled
                    ? "border-kolia-green bg-kolia-mint dark:bg-emerald-900/40 text-kolia-green"
                    : "border-borderColor bg-bgSecondary text-textSecondary hover:border-slate-400"
                }`}
                title="Chỉ hiển thị chủ đề có ít nhất 5 video từ ít nhất 3 kênh"
              >
                <input
                  type="checkbox"
                  checked={filterEnabled}
                  onChange={(e) => setFilterEnabled(e.target.checked)}
                  className="sr-only"
                />
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <div
                  className={`h-4 w-7 rounded-full relative transition-colors ${
                    filterEnabled ? "bg-kolia-green" : "bg-slate-500"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-xs transition-transform ${
                      filterEnabled ? "translate-x-3" : ""
                    }`}
                  />
                </div>
                <span className="text-[11px] font-semibold whitespace-nowrap text-textSecondary">Lọc chủ đề nhỏ</span>
              </label>
            </div>
          </div>
        </div>

        {/* mobile legend drawer */}
        {mobileLegendOpen && (
          <div className="xl:hidden border-t border-slate-100 dark:border-slate-800/60 p-4">
            <HowToReadPanel />
          </div>
        )}
      </div>

      {/* ── Body grid ───────────────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_240px_280px] p-5 bg-bgTertiary">
        {/* Chart */}
        <div className="rounded-2xl border border-borderColor bg-bgSecondary p-4 order-1">
          <div className="relative h-[400px] sm:h-[440px]">
            {/* Top quadrant badges — sit above the plot, never over the bubbles */}
            <div className="flex items-start justify-between gap-3 px-0.5 pb-2">
              <div className="inline-flex flex-col gap-0.5 rounded-lg border border-[#0F8C6F]/20 bg-[#0F8C6F]/[0.06] px-2.5 py-1.5">
                <span className="text-[10px] font-bold text-[#0F8C6F] leading-none">Cơ hội ưu tiên</span>
                <span className="text-[8.5px] font-medium text-[#0F8C6F]/70 leading-none">
                  Nhu cầu cao · Cạnh tranh thấp
                </span>
              </div>
              <div className="inline-flex flex-col items-end gap-0.5 rounded-lg border border-[#3B5BFD]/20 bg-[#3B5BFD]/[0.05] px-2.5 py-1.5 text-right">
                <span className="text-[10px] font-bold text-[#3B5BFD] leading-none">Cần tạo khác biệt</span>
                <span className="text-[8.5px] font-medium text-[#3B5BFD]/70 leading-none">
                  Nhu cầu cao · Cạnh tranh cao
                </span>
              </div>
            </div>

            <div ref={containerRef} className="h-[300px] sm:h-[330px] relative">
              {/* quadrant background wash — signature detail, clipped independently so bubbles are never cropped */}
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 rounded-xl overflow-hidden pointer-events-none">
                <div style={{ background: QUADRANT_META.opportunity.wash }} />
                <div style={{ background: QUADRANT_META.differentiate.wash }} />
                <div style={{ background: QUADRANT_META.watch.wash }} />
                <div style={{ background: QUADRANT_META.avoid.wash }} />
              </div>

              {hoveredPoint && (
                <BubbleTooltip point={hoveredPoint} chartX={hoverPos.x} chartY={hoverPos.y} containerW={containerW} />
              )}
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 24, right: 40, bottom: 36, left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name={xLabel}
                    scale="log"
                    domain={["auto", "auto"]}
                    ticks={[0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]}
                    tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border-color)" }}
                    label={{
                      value: xLabel,
                      position: "insideBottom",
                      offset: -20,
                      fontSize: 9,
                      fill: "var(--text-muted)",
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name={yLabel}
                    tickCount={5}
                    ticks={[1, 5, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000]}
                    tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border-color)" }}
                    tickFormatter={(v: number) => (yMetric === "outlierRate" ? `${v}%` : fv(v))}
                    label={{
                      value: yLabel,
                      angle: -90,
                      position: "insideLeft",
                      offset: 10,
                      fontSize: 9,
                      fill: "var(--text-muted)",
                      style: { textAnchor: "middle" },
                    }}
                  />
                  <ZAxis type="number" dataKey="z" range={[1, 1]} />
                  <ReferenceLine x={midX} stroke="var(--border-color)" strokeDasharray="5 4" strokeWidth={1.5} />
                  <ReferenceLine y={midY} stroke="var(--border-color)" strokeDasharray="5 4" strokeWidth={1.5} />
                  <Scatter
                    data={points}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    shape={(props: any) => (
                      <BubbleDot
                        cx={props.cx}
                        cy={props.cy}
                        payload={props.payload as BubblePoint}
                        onHover={handleHover}
                        onSelect={handleSelect}
                        selectedSlug={selectedSlug}
                      />
                    )}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-end justify-between gap-3 px-0.5 pt-2">
              <div className="inline-flex flex-col gap-0.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-none">Theo dõi thêm</span>
                <span className="text-[8.5px] font-medium text-slate-400 leading-none">
                  Nhu cầu thấp · Cạnh tranh thấp
                </span>
              </div>
              <div className="inline-flex flex-col items-end gap-0.5 rounded-lg border border-[#E24C4C]/20 bg-[#E24C4C]/[0.05] px-2.5 py-1.5 text-right">
                <span className="text-[10px] font-bold text-[#E24C4C]/85 leading-none">Không ưu tiên</span>
                <span className="text-[8.5px] font-medium text-[#E24C4C]/60 leading-none">
                  Nhu cầu thấp · Cạnh tranh cao
                </span>
              </div>
            </div>
          </div>

          <p className="text-[10.5px] text-slate-400 text-center mt-3 flex items-center justify-center gap-1.5">
            <span aria-hidden>🖱</span>
            Click vào bong bóng để mở danh sách video gốc và kiểm chứng dữ liệu.
          </p>

          <div className="flex items-center justify-center gap-1 mt-1">
            <p className="text-[10px] text-slate-400">Thang log</p>
            <button
              title="Trục X dùng thang logarithm để hiện rõ hơn sự phân bố giữa các chủ đề có số video khác nhau lớn."
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kolia-green/40 rounded"
            >
              <Info className="h-3 w-3 text-slate-400" />
            </button>
          </div>
        </div>

        {/* How to read — desktop only */}
        <div className="hidden xl:block order-2">
          <HowToReadPanel />
        </div>

        {/* Detail panel */}
        <div className="rounded-2xl border border-borderColor bg-bgSecondary p-4 min-h-[420px] order-3">
          {selectedTopic ? (
            <TopicDetailSidebar
              topic={selectedTopic}
              onClose={() => setSelectedSlug(null)}
              onOpenVideoModal={() => setVideoModalOpen(true)}
              onOpenVideo={(v) => {
                setSelectedVideo(v);
                setVideoModalOpen(true);
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-10 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-600 dark:text-slate-400">Chi tiết chủ đề đang chọn</p>
                <p className="mt-1 text-[11px] text-slate-400 max-w-[180px] mx-auto leading-relaxed">
                  Click vào một bong bóng để xem chi tiết và danh sách video
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Video modal ─────────────────────────────────────────────────── */}
      {videoModalOpen && selectedTopic && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => {
            setVideoModalOpen(false);
            setSelectedVideo(null);
          }}
        >
          <div
            className="bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl w-full h-full sm:h-[82vh] sm:max-w-6xl flex flex-col lg:flex-row overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Player */}
            <div className="lg:w-3/4 flex flex-col bg-slate-950 min-h-[45%]">
              {selectedVideo ? (
                <>
                  <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
                    <div className="w-full max-w-4xl">
                      <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-xl ring-1 ring-white/10">
                        {selectedVideo.youtubeId ? (
                          <iframe
                            width="100%"
                            height="100%"
                            src={`https://www.youtube.com/embed/${selectedVideo.youtubeId}?autoplay=1`}
                            title={selectedVideo.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full h-full rounded-xl"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center text-slate-400">
                              <Play className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <p className="text-sm">Không có embed video</p>
                              <a
                                href={`https://youtube.com/watch?v=${selectedVideo.youtubeId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-2 text-xs text-slate-300 hover:text-white transition-colors"
                              >
                                Xem trên YouTube
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 border-t border-white/10 bg-slate-900">
                    <h4 className="text-sm font-semibold text-white mb-2 leading-snug">{selectedVideo.title}</h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 tabular-nums">
                      <span>{selectedVideo.channelName}</span>
                      <span className="opacity-40">•</span>
                      <span>{fv(selectedVideo.views)} lượt xem</span>
                      <span className="opacity-40">•</span>
                      <span>{pct(selectedVideo.engagementRate)} tương tác</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-6">
                  <div className="text-center text-slate-400">
                    <Play className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">Chọn một video từ danh sách bên cạnh để phát</p>
                  </div>
                </div>
              )}
            </div>

            {/* Playlist */}
            <div className="lg:w-1/4 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col min-h-0">
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
                <div className="min-w-0">
                  <h3 className="text-[14px] font-bold text-slate-800 dark:text-slate-200 truncate">{selectedTopic.name}</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    {safeArr<TopicVideo>(selectedTopic.sampleVideos).length} video
                  </p>
                </div>
                <button
                  onClick={() => {
                    setVideoModalOpen(false);
                    setSelectedVideo(null);
                  }}
                  className="p-2 hover:bg-slate-200 rounded-lg transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kolia-green/40"
                  aria-label="Đóng"
                >
                  <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {safeArr<TopicVideo>(selectedTopic.sampleVideos).map((video, index) => (
                  <div
                    key={video.id}
                    onClick={() => setSelectedVideo(video)}
                    className={`flex gap-2.5 rounded-xl p-2 cursor-pointer transition-colors ${
                      selectedVideo?.id === video.id ? "bg-kolia-ink text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold w-4 shrink-0 text-center tabular-nums pt-1 ${
                        selectedVideo?.id === video.id ? "text-white/70" : "text-slate-400"
                      }`}
                    >
                      {index + 1}
                    </span>
                    {video.thumbnailUrl ? (
                      <div className="relative shrink-0 rounded-lg overflow-hidden w-16 h-10 bg-slate-100 dark:bg-slate-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="shrink-0 rounded-lg w-16 h-10 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Play className="h-3 w-3 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[10.5px] font-medium truncate leading-tight ${
                          selectedVideo?.id === video.id ? "text-white" : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {video.title}
                      </p>
                      <p
                        className={`text-[9.5px] truncate mt-0.5 ${
                          selectedVideo?.id === video.id ? "text-slate-300" : "text-slate-400"
                        }`}
                      >
                        {video.channelName}
                      </p>
                      <p
                        className={`text-[9.5px] font-semibold mt-0.5 tabular-nums ${
                          selectedVideo?.id === video.id ? "text-white" : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {fv(video.views)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}