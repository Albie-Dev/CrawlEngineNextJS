"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
} from "lucide-react";
import type { TopicRow, TopicVideo } from "@/lib/contentGapSnapshot";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Quadrant helpers ─────────────────────────────────────────────────────────

type QuadrantId = "opportunity" | "differentiate" | "watch" | "avoid";

function getQuadrant(x: number, y: number, midX: number, midY: number): QuadrantId {
  if (y >= midY && x < midX) return "opportunity";
  if (y >= midY && x >= midX) return "differentiate";
  if (y < midY && x < midX) return "watch";
  return "avoid";
}

const QUADRANT_META: Record<QuadrantId, { label: string; sub: string; color: string }> = {
  opportunity: { label: "Cơ hội ưu tiên", sub: "Nhu cầu cao · Cạnh tranh thấp", color: "#0F8C6F" },
  differentiate: { label: "Cần tạo khác biệt", sub: "Nhu cầu cao · Cạnh tranh cao", color: "#3B82F6" },
  watch: { label: "Theo dõi thêm", sub: "Nhu cầu thấp · Cạnh tranh thấp", color: "#94A3B8" },
  avoid: { label: "Không ưu tiên", sub: "Nhu cầu thấp · Cạnh tranh cao", color: "#EF4444" },
};

// ─── Growth color ─────────────────────────────────────────────────────────────

function growthColor(rate: number): string {
  if (rate > 15) return "#0F8C6F";
  if (rate >= -15) return "#F59E0B";
  return "#EF4444";
}

type GrowthInfo = { label: string; color: string; icon: "up" | "flat" | "down"; numStr: string };
function growthInfo(rate: number): GrowthInfo {
  if (rate > 15) return { label: "Tăng mạnh", color: "#0F8C6F", icon: "up", numStr: `+${rate}%` };
  if (rate >= -15) return { label: "Ổn định", color: "#F59E0B", icon: "flat", numStr: `${rate >= 0 ? "+" : ""}${rate}%` };
  return { label: "Giảm", color: "#EF4444", icon: "down", numStr: `${rate}%` };
}

// ─── Safe field access (for older snapshots without new fields) ───────────────

function safeNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && isFinite(v) ? v : fallback;
}

function safeArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

// ─── Bubble size scale ────────────────────────────────────────────────────────

function bubbleRadius(totalViews: number, maxViews: number): number {
  const minR = 9;
  const maxR = 30;
  if (maxViews === 0) return minR;
  const ratio = Math.sqrt(totalViews / maxViews);
  return Math.round(minR + ratio * (maxR - minR));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type YMetric = "outlierRate" | "medianViews";
type XMetric = "competitionScore" | "videoCount";

interface BubblePoint {
  x: number;
  y: number;
  z: number;     // for ZAxis (unused but required by recharts Scatter)
  r: number;     // actual pixel radius
  topic: TopicRow;
}

// ─── Custom scatter shape (bubble) ───────────────────────────────────────────

interface ScatterShapeProps {
  cx?: number;
  cy?: number;
  payload?: BubblePoint;
  onHover: (p: BubblePoint | null, cx: number, cy: number) => void;
  onSelect: (p: BubblePoint) => void;
  selectedSlug: string | null;
}

function BubbleDot({
  cx = 0,
  cy = 0,
  payload,
  onHover,
  onSelect,
  selectedSlug,
}: ScatterShapeProps) {
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
    >
      <circle
        cx={cx}
        cy={cy}
        r={r + (isSelected ? 4 : 0)}
        fill={color}
        fillOpacity={isSelected ? 0.92 : 0.8}
        stroke="#fff"
        strokeWidth={isSelected ? 3 : 1.5}
      />
      {r >= 18 && (
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={8}
          fill="#fff"
          fontWeight={600}
          pointerEvents="none"
          style={{ userSelect: "none" }}
        >
          {payload.topic.name.length > 9 ? payload.topic.name.slice(0, 8) + "…" : payload.topic.name}
        </text>
      )}
    </g>
  );
}

// ─── Floating tooltip ─────────────────────────────────────────────────────────

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
  // Flip to left if near right edge
  const flipLeft = chartX > containerW - 240;

  return (
    <div
      className="pointer-events-none absolute z-50 min-w-[210px] rounded-xl border border-slate-100 bg-white p-3.5 shadow-xl"
      style={{
        top: Math.max(0, chartY - 10),
        left: flipLeft ? chartX - 220 : chartX + 16,
      }}
    >
      <p className="font-bold text-slate-800 text-[13px] mb-2.5">{topic.name}</p>
      <div className="space-y-1.5 text-[11px] text-slate-600">
        {[
          ["Số video", topic.videoCount],
          ["Số kênh", topic.channelCount],
          ["Tổng lượt xem", fv(safeNum(topic.totalViews))],
          ["Trung vị lượt xem", fv(topic.medianViews)],
          ["Tỷ lệ tương tác", pct(safeNum(topic.avgEngagement))],
          ["Tỷ lệ video outlier", pct(safeNum(topic.outlierRate))],
        ].map(([k, v]) => (
          <div key={String(k)} className="flex justify-between gap-4">
            <span>{k}</span>
            <span className="font-semibold text-slate-800">{v}</span>
          </div>
        ))}
        <div className="flex justify-between gap-4">
          <span>Xu hướng 30 ngày</span>
          <span className="font-semibold" style={{ color: gi.color }}>
            {gi.numStr}
          </span>
        </div>
      </div>
      <p className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-400">
        Click để xem danh sách video
      </p>
    </div>
  );
}

// ─── Topic detail sidebar ─────────────────────────────────────────────────────

function GrowthIcon({ icon }: { icon: "up" | "flat" | "down" }) {
  if (icon === "up") return <TrendingUp className="h-3 w-3" />;
  if (icon === "down") return <TrendingDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
}

function VideoRow({ video, index }: { video: TopicVideo; index: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg hover:bg-slate-50 px-1 py-1.5 transition-colors group">
      <span className="text-[10px] text-slate-400 w-4 shrink-0 text-center">{index}</span>
      {video.thumbnailUrl ? (
        <div className="relative shrink-0 rounded overflow-hidden w-12 h-8 bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="shrink-0 rounded w-12 h-8 bg-slate-100 flex items-center justify-center">
          <Play className="h-3 w-3 text-slate-300" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-slate-700 truncate leading-tight">{video.title}</p>
        <p className="text-[10px] text-slate-400 truncate">{video.channelName}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-semibold text-slate-700">{fv(video.views)}</p>
        <p className="text-[10px] text-slate-400">{pct(video.engagementRate)}</p>
      </div>
      {video.youtubeId && (
        <a
          href={`https://youtube.com/watch?v=${video.youtubeId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600"
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
}: {
  topic: TopicRow;
  onClose: () => void;
}) {
  const gi = growthInfo(safeNum(topic.growthRate30d));
  const videos = safeArr<TopicVideo>(topic.sampleVideos).slice(0, 5);
  const quadrant =
    topic.priority === "Cao"
      ? QUADRANT_META.opportunity
      : topic.priority === "Trung bình"
      ? QUADRANT_META.differentiate
      : QUADRANT_META.watch;

  const reliabilityLabel =
    topic.videoCount >= 10 ? "Cao" : topic.videoCount >= 5 ? "Trung bình" : "Thấp";
  const reliabilityColor =
    topic.videoCount >= 10 ? "#0F8C6F" : topic.videoCount >= 5 ? "#F59E0B" : "#EF4444";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <span
          className="rounded-md px-2 py-0.5 text-[11px] font-bold"
          style={{ background: quadrant.color + "15", color: quadrant.color }}
        >
          {quadrant.label}
        </span>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <h3 className="text-[14px] font-bold text-slate-800 mb-3 shrink-0 leading-snug">{topic.name}</h3>

      {/* Stats block */}
      <div className="shrink-0 mb-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Xác định đáy thị trường
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
          <div key={k} className="flex justify-between text-[12px]">
            <span className="text-slate-500">{k}</span>
            <span className="font-semibold text-slate-800">{v}</span>
          </div>
        ))}
        <div className="flex justify-between text-[12px]">
          <span className="text-slate-500">Xu hướng 30 ngày</span>
          <span className="font-semibold flex items-center gap-1" style={{ color: gi.color }}>
            <GrowthIcon icon={gi.icon} />
            {gi.numStr}
          </span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="text-slate-500">Mức phù hợp với kênh của bạn</span>
          <span className="font-bold text-[#0F8C6F]">
            {topic.priority === "Cao" ? "Cao" : topic.priority === "Trung bình" ? "Trung bình" : "Thấp"}
          </span>
        </div>
        <div className="flex justify-between text-[12px]">
          <span className="text-slate-500">Độ tin cậy</span>
          <span className="font-bold" style={{ color: reliabilityColor }}>
            {reliabilityLabel}
          </span>
        </div>
      </div>

      {/* Video list */}
      <div className="flex items-center justify-between mb-1.5 shrink-0">
        <p className="text-[11px] font-bold text-slate-700">Video nguồn tạo nên chủ đề</p>
      </div>
      <div className="shrink-0 grid grid-cols-[20px_1fr_auto] gap-1 px-1 pb-1 border-b border-slate-100">
        <span className="text-[10px] text-slate-400">#</span>
        <span className="text-[10px] text-slate-400">Video</span>
        <span className="text-[10px] text-slate-400 text-right">Lượt xem / Tương tác</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0 mt-1">
        {videos.length > 0 ? (
          videos.map((v, i) => <VideoRow key={v.id} video={v} index={i + 1} />)
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-slate-400 text-xs gap-2">
            <Eye className="h-5 w-5 opacity-30" />
            Chưa có dữ liệu video
          </div>
        )}
      </div>

      {/* See all */}
      {videos.length > 0 && (
        <button className="mt-2 shrink-0 w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
          Xem tất cả video gốc
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Small sample warning */}
      {topic.videoCount < 5 && (
        <div className="mt-2 shrink-0 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-amber-700">
              Mẫu nhỏ: {topic.videoCount} video
            </p>
            <p className="text-[10px] text-amber-600">Độ tin cậy thấp — không nên kết luận mạnh khi dữ liệu quá ít.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── How-to-read panel ────────────────────────────────────────────────────────

function HowToReadPanel() {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 h-full flex flex-col">
      <div className="flex items-center gap-1.5 mb-3 shrink-0">
        <p className="text-[12px] font-bold text-slate-700">Cách đọc biểu đồ</p>
        <Info className="h-3.5 w-3.5 text-slate-400" />
      </div>
      {/* Bubble size */}
      <div className="mb-3 shrink-0">
        <p className="text-[10px] font-semibold text-slate-500 mb-2">Kích thước bong bóng (Tổng lượt xem)</p>
        <div className="flex items-end gap-4">
          {[
            { label: "Thấp\n(<100K)", r: 9 },
            { label: "Trung bình\n(100K–1M)", r: 15 },
            { label: "Cao\n(>1M)", r: 22 },
          ].map(({ label, r }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className="rounded-full bg-slate-300 shrink-0"
                style={{ width: r * 2, height: r * 2 }}
              />
              <p className="text-[9px] text-slate-400 text-center whitespace-pre-line leading-tight">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
      {/* Color legend */}
      <div className="mb-3 shrink-0">
        <p className="text-[10px] font-semibold text-slate-500 mb-1.5">Màu sắc (Tốc độ tăng trưởng 30 ngày)</p>
        <div className="space-y-1.5">
          {[
            { color: "#0F8C6F", label: "Tăng mạnh", sub: "(>+15%)" },
            { color: "#F59E0B", label: "Ổn định", sub: "(-15% đến +15%)" },
            { color: "#EF4444", label: "Giảm", sub: "(<-15%)" },
          ].map(({ color, label, sub }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[11px] text-slate-700 font-medium">{label}</span>
              <span className="text-[10px] text-slate-400">{sub}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Quadrant guide */}
      <div className="flex-1 border-t border-slate-100 pt-3">
        <p className="text-[10px] font-semibold text-slate-500 mb-2">Gợi ý đọc nhanh</p>
        <div className="space-y-2">
          {(Object.entries(QUADRANT_META) as [QuadrantId, typeof QUADRANT_META[QuadrantId]][]).map(
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
      {/* Warning note */}
      <div className="mt-3 shrink-0 flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 p-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[10px] font-bold text-amber-700">Mẫu nhỏ: 1 video — Độ tin cậy thấp</p>
          <p className="text-[10px] text-amber-600">Không nên kết luận mạnh khi dữ liệu quá ít.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

// ─── Main component ───────────────────────────────────────────────────────────

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
  const containerRef = useRef<HTMLDivElement>(null);

  const MIN_VIDEOS = 5;
  const MIN_CHANNELS = 3;

  // Filter topics
  const filtered = topics.filter((t) => {
    if (filterEnabled && (t.videoCount < MIN_VIDEOS || t.channelCount < MIN_CHANNELS)) {
      return false;
    }
    if (timeframe !== "all" && t.sampleVideos && t.sampleVideos.length > 0) {
      const days = parseInt(timeframe, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const hasRecent = t.sampleVideos.some((v) => new Date(v.publishedAt) >= cutoff);
      if (!hasRecent) return false;
    }
    return true;
  });

  // Compute X and Y per topic
  function getX(t: TopicRow): number {
    const raw = xMetric === "competitionScore" ? safeNum(t.competitionScore, t.channelCount > 0 ? t.videoCount / t.channelCount : t.videoCount) : t.videoCount;
    return Math.max(0.1, raw); // avoid 0 for log scale
  }

  function getY(t: TopicRow): number {
    if (yMetric === "outlierRate") return Math.round(safeNum(t.outlierRate) * 1000) / 10; // 0–100%
    return t.medianViews;
  }

  const maxTotalViews = Math.max(...filtered.map((t) => safeNum(t.totalViews)), 1);

  // Build points
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

  const selectedTopic = selectedSlug
    ? filtered.find((t) => t.slug === selectedSlug) ?? null
    : null;

  const handleHover = useCallback(
    (p: BubblePoint | null, cx: number, cy: number) => {
      setHoveredPoint(p);
      if (p) setHoverPos({ x: cx, y: cy });
    },
    []
  );

  const handleSelect = useCallback((p: BubblePoint) => {
    setSelectedSlug((prev) => (prev === p.topic.slug ? null : p.topic.slug));
    setHoveredPoint(null);
  }, []);

  const yLabel =
    yMetric === "outlierRate"
      ? "Hiệu suất chủ đề (tỷ lệ video outlier %)"
      : "Hiệu suất chủ đề (trung vị lượt xem)";

  const xLabel =
    xMetric === "competitionScore"
      ? "Mức cạnh tranh (# video / # kênh đang làm chủ đề)"
      : "Mức cạnh tranh (# video đang làm chủ đề)";

  const containerW = containerRef.current?.clientWidth ?? 600;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 border-b border-slate-100 p-5 bg-white">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Ma trận cơ hội nội dung</h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-slate-600">
            <div className="flex items-center gap-1.5 bg-slate-50/80 border border-slate-200 rounded-md px-2 py-1">
              <span className="font-semibold text-slate-700">Trục X:</span> 
              <span>Mức cạnh tranh</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50/80 border border-slate-200 rounded-md px-2 py-1">
              <span className="font-semibold text-slate-700">Trục Y:</span> 
              <span>Hiệu suất</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50/80 border border-slate-200 rounded-md px-2 py-1">
              <div className="flex items-center gap-0.5 opacity-70">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-slate-500"></div>
              </div>
              <span className="font-semibold text-slate-700">Kích thước:</span> 
              <span>Tổng lượt xem</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50/80 border border-slate-200 rounded-md px-2 py-1">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-rose-500 via-amber-400 to-emerald-500"></div>
              <span className="font-semibold text-slate-700">Màu sắc:</span> 
              <span>Độ tăng trưởng</span>
            </div>
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Metric selector: Y + X as inline chip group */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs">
            <div className="flex items-center gap-1 px-2">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Y:</span>
              {["outlierRate", "medianViews"].map((key) => (
                <button
                  key={key}
                  onClick={() => setYMetric(key as YMetric)}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition whitespace-nowrap ${
                    yMetric === key
                      ? "bg-kolia-ink text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {key === "outlierRate" ? "Tỷ lệ outlier" : "Trung vị views"}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div className="flex items-center gap-1 px-2">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">X:</span>
              {["competitionScore", "videoCount"].map((key) => (
                <button
                  key={key}
                  onClick={() => setXMetric(key as XMetric)}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition whitespace-nowrap ${
                    xMetric === key
                      ? "bg-kolia-ink text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {key === "competitionScore" ? "Cạnh tranh" : "Số video"}
                </button>
              ))}
            </div>
          </div>

          {/* Timeframe pills */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs">
            {["30", "60", "90"].map((days) => (
              <button
                key={days}
                onClick={() => setTimeframe(days)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition whitespace-nowrap ${
                  timeframe === days
                    ? "bg-kolia-ink text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {days} ngày
              </button>
            ))}
          </div>

          {/* Filter toggle as a clean chip */}
          <label
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 cursor-pointer select-none transition ${
              filterEnabled
                ? "border-kolia-green bg-kolia-mint text-kolia-green"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
            }`}
            title="Chỉ hiển thị chủ đề có ít nhất 5 video từ ít nhất 3 kênh"
          >
            <input
              type="checkbox"
              checked={filterEnabled}
              onChange={(e) => setFilterEnabled(e.target.checked)}
              className="sr-only"
            />
            <div className={`h-4 w-7 rounded-full relative transition-colors ${filterEnabled ? "bg-kolia-green" : "bg-slate-300"}`}>
              <div className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-xs transition-transform ${filterEnabled ? "translate-x-3" : ""}`} />
            </div>
            <span className="text-[11px] font-semibold whitespace-nowrap">Lọc chủ đề nhỏ</span>
          </label>
        </div>
      </div>

      {/* ── 3-column layout ── */}
      <div className="grid gap-6 xl:grid-cols-[1fr_260px_280px] p-5 pt-4 bg-slate-50/30">
        {/* ── Chart ── */}
        <div className="rounded-xl border border-slate-100 bg-white p-4">
          {/* Quadrant label overlay */}
          <div className="relative">
            <div className="absolute top-0 left-0 flex gap-4 w-full justify-between pointer-events-none z-10 px-1">
              <span className="text-[10px] font-bold text-[#0F8C6F] leading-tight">
                Cơ hội ưu tiên<br />
                <span className="text-[8px] font-normal text-[#0F8C6F]/70">Nhu cầu cao · Cạnh tranh thấp</span>
              </span>
              <span className="text-[10px] font-bold text-blue-500 leading-tight text-right">
                Cần tạo khác biệt<br />
                <span className="text-[8px] font-normal text-blue-400">Nhu cầu cao · Cạnh tranh cao</span>
              </span>
            </div>
          </div>

          {/* Recharts Scatter */}
          <div ref={containerRef} className="h-[380px] relative mt-6">
            {hoveredPoint && (
              <BubbleTooltip
                point={hoveredPoint}
                chartX={hoverPos.x}
                chartY={hoverPos.y}
                containerW={containerW}
              />
            )}
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 36, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={xLabel}
                  scale="log"
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 9, fill: "#94A3B8" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8F0" }}
                  label={{
                    value: xLabel,
                    position: "insideBottom",
                    offset: -20,
                    fontSize: 9,
                    fill: "#94A3B8",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={yLabel}
                  tick={{ fontSize: 9, fill: "#94A3B8" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickFormatter={(v: number) => yMetric === "outlierRate" ? `${v}%` : fv(v)}
                  label={{
                    value: yLabel,
                    angle: -90,
                    position: "insideLeft",
                    offset: 10,
                    fontSize: 9,
                    fill: "#94A3B8",
                    style: { textAnchor: "middle" },
                  }}
                />
                <ZAxis type="number" dataKey="z" range={[1, 1]} />
                {/* Quadrant dividers */}
                <ReferenceLine x={midX} stroke="#E2E8F0" strokeDasharray="5 4" strokeWidth={1.5} />
                <ReferenceLine y={midY} stroke="#E2E8F0" strokeDasharray="5 4" strokeWidth={1.5} />
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

          {/* Bottom quadrant labels */}
          <div className="flex justify-between px-1 -mt-4 pointer-events-none">
            <span className="text-[10px] font-bold text-slate-400 leading-tight">
              Theo dõi thêm<br />
              <span className="text-[8px] font-normal text-slate-300">Nhu cầu thấp · Cạnh tranh thấp</span>
            </span>
            <span className="text-[10px] font-bold text-red-400 leading-tight text-right">
              Không ưu tiên<br />
              <span className="text-[8px] font-normal text-red-300">Nhu cầu thấp · Cạnh tranh cao</span>
            </span>
          </div>

          <p className="text-[10px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
            <span>🖱</span>
            Click vào bong bóng để mở danh sách video gốc và kiểm chứng dữ liệu.
          </p>

          {/* Thang log note */}
          <div className="flex items-center justify-center gap-1 mt-1">
            <p className="text-[10px] text-slate-400">Thang log</p>
            <button title="Trục X dùng thang logarithm để hiện rõ hơn sự phân bố giữa các chủ đề có số video khác nhau lớn.">
              <Info className="h-3 w-3 text-slate-400" />
            </button>
          </div>
        </div>

        {/* ── How to read ── */}
        <HowToReadPanel />

        {/* ── Right detail panel ── */}
        <div className="rounded-xl border border-slate-100 bg-white p-4 min-h-[450px]">
          {selectedTopic ? (
            <TopicDetailSidebar
              topic={selectedTopic}
              onClose={() => setSelectedSlug(null)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-600">Chi tiết chủ đề đang chọn</p>
                <p className="mt-1 text-[11px] text-slate-400 max-w-[160px] mx-auto">
                  Click vào một bong bóng để xem chi tiết và danh sách video
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
