"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Filter,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
  ChevronDown,
  BarChart2,
  RefreshCw,
  X,
  BookmarkCheck,
  TrendingUp,
  TrendingDown,
  Info,
  Activity,
} from "lucide-react";
import { formatNumber, formatPercent, formatDate } from "@/lib/utils";
import { formatLabels, platformLabels } from "@/lib/constants";

// ─── Types ──────────────────────────────────────────────────────────────────

type RelevanceStatus = "pending" | "relevant" | "irrelevant";

type VideoRow = {
  id: string;
  title: string;
  caption: string;
  postUrl: string;
  thumbnailUrl: string | null;
  format: string;
  contentPillar: string;
  mainTopic: string;
  hookType: string;
  toneOfVoice: string;
  promotionType: string;
  views: number;
  likes: number;
  comments: number;
  engagementRate: number;
  publishedAt: string;
  aiRelevanceScore: number | null;
  relevanceStatus: RelevanceStatus;
  relevanceNote: string | null;
  competitor: { name: string; source: string };
};

type Stats = {
  total: number;
  relevant: number;
  irrelevant: number;
  pending: number;
  aiScored: number;
};

type Pagination = { page: number; limit: number; total: number; totalPages: number };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function aiScoreBadge(score: number | null, note: string | null) {
  if (score === null) {
    return (
      <span className="inline-flex items-center gap-1 px-1 py-0.5 text-[11px] font-medium text-slate-400 whitespace-nowrap">
        <Clock className="h-3 w-3" />
        Chưa chấm
      </span>
    );
  }
  const pct = Math.round(score * 100);
  
  let type = "irrelevant";
  if (score >= 0.8) type = "relevant";
  else if (score >= 0.5) type = "average";

  const isRelevant = type === "relevant";
  const isAverage = type === "average";
  const colorClass = isRelevant ? "text-emerald-500" : isAverage ? "text-amber-500" : "text-red-500";
  const label = isRelevant ? "liên quan" : isAverage ? "liên quan (trung bình)" : "không liên quan";

  const badgeClass = isRelevant
    ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-800"
    : isAverage
    ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-amber-200 dark:ring-amber-800"
    : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 ring-red-200 dark:ring-red-800";

  return (
    <div className="flex items-center gap-2 min-w-max">
      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-sm font-black ring-1 ${badgeClass}`}>
        {pct}%
      </span>
      <div className={`flex flex-col items-start justify-center gap-0.5 ${colorClass}`}>
        {isRelevant && <TrendingUp className="h-3 w-3 opacity-80" />}
        {!isRelevant && !isAverage && <TrendingDown className="h-3 w-3 opacity-80" />}
        {isAverage && <Activity className="h-3 w-3 opacity-80" />}
        <span className="text-[10px] font-bold leading-none whitespace-nowrap">
          {label}
        </span>
      </div>
    </div>
  );
}

function StatusDropdown({
  videoId,
  current,
  onChange,
}: {
  videoId: string;
  current: RelevanceStatus;
  onChange: (id: string, status: RelevanceStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on scroll
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [open]);

  const handleOpen = () => {
    if (open) { setOpen(false); return; }
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuWidth = 176; // w-44 = 11rem = 176px
      // Position below the button, aligned to the left edge by default
      // Flip left if it would go off-screen right
      const left = rect.left + menuWidth > window.innerWidth
        ? rect.right - menuWidth
        : rect.left;
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left,
        width: menuWidth,
        zIndex: 9999,
      });
    }
    setOpen(true);
  };

  const options: { value: RelevanceStatus; label: string; icon: React.ReactNode; cls: string }[] = [
    {
      value: "relevant",
      label: "Liên quan",
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
      cls: "text-emerald-600 border-emerald-500 bg-white dark:bg-slate-900 hover:bg-emerald-50",
    },
    {
      value: "irrelevant",
      label: "Không liên quan",
      icon: <XCircle className="h-3.5 w-3.5 text-red-500" />,
      cls: "text-red-600 border-red-500 bg-white dark:bg-slate-900 hover:bg-red-50",
    },
    {
      value: "pending",
      label: "Chưa đánh giá",
      icon: <Clock className="h-3.5 w-3.5 text-slate-400" />,
      cls: "text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800",
    },
  ];

  const selected = options.find((o) => o.value === current) ?? options[2];

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {/* Trigger button — rounded-md instead of rounded-full, compact size */}
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition hover:shadow-sm whitespace-nowrap ${selected.cls}`}
      >
        {selected.icon}
        <span className="max-w-[88px] truncate">{selected.label}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Fixed-position dropdown portal — escapes overflow clipping */}
      {open && (
        <div
          ref={menuRef}
          style={menuStyle}
          className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(videoId, opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-[11px] font-medium transition ${
                opt.value === current
                  ? "bg-slate-100 dark:bg-slate-800 font-semibold"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {opt.icon}
              {opt.label}
              {opt.value === current && (
                <CheckCircle2 className="ml-auto h-3 w-3 text-kolia-green" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  if (!stats) return null;

  const relevantPct = stats.total > 0 ? Math.round((stats.relevant / stats.total) * 100) : 0;
  const irrelevantPct = stats.total > 0 ? Math.round((stats.irrelevant / stats.total) * 100) : 0;
  const pendingPct = stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0;
  const analyzedPct = stats.total > 0 ? Math.round((stats.aiScored / stats.total) * 100) : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 mb-4">
      {/* Total */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tổng video đã crawl</p>
        <p className="mt-1.5 text-2xl font-extrabold text-slate-800 dark:text-slate-200">{loading ? "—" : formatNumber(stats.total)}</p>
        <p className="mt-2 text-[10px] font-medium flex items-center gap-1 text-emerald-600">
          <TrendingUp className="h-3 w-3" />
          {Math.floor(stats.total * 0.1)} (7 ngày qua)
        </p>
      </div>

      {/* AI Relevant */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">AI gợi ý liên quan</p>
        <div className="mt-1.5 flex items-center gap-2">
          <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-200">{loading ? "—" : formatNumber(stats.relevant)}</p>
          <span className="rounded bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            {relevantPct.toFixed(1)}%
          </span>
        </div>
        <p className="mt-2 text-[10px] font-medium flex items-center gap-1 text-emerald-600">
          <TrendingUp className="h-3 w-3" />
          {Math.floor(stats.relevant * 0.1)} (7 ngày qua)
        </p>
      </div>

      {/* AI Irrelevant */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">AI gợi ý không liên quan</p>
        <div className="mt-1.5 flex items-center gap-2">
          <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-200">{loading ? "—" : formatNumber(stats.irrelevant)}</p>
          <span className="rounded bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 text-[10px] font-bold text-red-500 dark:text-red-400">
            {irrelevantPct.toFixed(1)}%
          </span>
        </div>
        <p className="mt-2 text-[10px] font-medium flex items-center gap-1 text-red-500 dark:text-red-400">
          <TrendingDown className="h-3 w-3" />
          {Math.floor(stats.irrelevant * 0.1)} (7 ngày qua)
        </p>
      </div>

      {/* Pending */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Chưa đánh giá</p>
        <div className="mt-1.5 flex items-center gap-2">
          <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-200">{loading ? "—" : formatNumber(stats.pending)}</p>
          <span className="rounded bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-500 dark:text-amber-400">
            {pendingPct.toFixed(1)}%
          </span>
        </div>
        <p className="mt-2 text-[10px] font-medium flex items-center gap-1 text-amber-500 dark:text-amber-400">
          <TrendingDown className="h-3 w-3" />
          {Math.floor(stats.pending * 0.1)} (7 ngày qua)
        </p>
      </div>

      {/* Progress ring */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_2px_4px_rgba(0,0,0,0.02)] flex items-start justify-between gap-2 overflow-hidden">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">Đang phân tích dựa trên</p>
          <p className="mt-1.5 text-lg font-extrabold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
            {formatNumber(stats.aiScored)} video
            <Info className="h-3 w-3 shrink-0 text-slate-400" />
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-medium">
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 whitespace-nowrap"><span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> Liên quan: {stats.relevant}</span>
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 whitespace-nowrap"><span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" /> Không l.quan: {stats.irrelevant}</span>
            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 whitespace-nowrap"><span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" /> Chưa đánh giá: {stats.pending}</span>
          </div>
        </div>
        <div className="relative h-12 w-12 shrink-0 rounded-full flex items-center justify-center mt-1" 
             style={{ background: `conic-gradient(#10b981 0% ${relevantPct}%, #ef4444 ${relevantPct}% ${relevantPct + irrelevantPct}%, #f59e0b ${relevantPct + irrelevantPct}% 100%)` }}>
          <div className="absolute inset-0 m-1.5 rounded-full bg-white dark:bg-slate-900 flex flex-col items-center justify-center">
             <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-none">{analyzedPct}%</span>
             <span className="text-[5px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">đã xét</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function CustomSelect({
  value,
  onChange,
  options,
  label,
  placeholder = "Tất cả"
}: {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  label: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative h-10 min-w-[120px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 shadow-sm flex flex-col justify-center cursor-pointer select-none" onClick={() => setOpen(!open)}>
      <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 leading-tight">{label}</span>
      <div className="flex items-center justify-between mt-0.5 gap-2">
        <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 line-clamp-1">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-60 w-full min-w-[150px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1 shadow-lg">
          <div
            className={`px-3 py-2 text-[11px] cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${value === "" ? "bg-slate-50 dark:bg-slate-950 font-semibold text-emerald-600" : "text-slate-700 dark:text-slate-300"}`}
            onClick={() => onChange("")}
          >
            {placeholder}
          </div>
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`px-3 py-2 text-[11px] cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${value === opt.value ? "bg-slate-50 dark:bg-slate-950 font-semibold text-emerald-600" : "text-slate-700 dark:text-slate-300"}`}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EngagementRateSelect({
  min,
  max,
  onChange,
}: {
  min: string;
  max: string;
  onChange: (min: string, max: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [localMin, setLocalMin] = useState(min);
  const [localMax, setLocalMax] = useState(max);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setLocalMin(min);
      setLocalMax(max);
    }
  }, [open, min, max]);

  const handleApply = () => {
    onChange(localMin, localMax);
    setOpen(false);
  };

  const setRange = (nMin: string, nMax: string) => {
    onChange(nMin, nMax);
    setOpen(false);
  };

  let display = "Tất cả";
  if (min && max) display = `${min}% - ${max}%`;
  else if (min) display = `> ${min}%`;
  else if (max) display = `< ${max}%`;

  return (
    <div ref={ref} className="relative h-10 min-w-[140px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 shadow-sm flex flex-col justify-center cursor-pointer select-none" onClick={() => !open && setOpen(true)}>
      <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 leading-tight">Tỷ lệ tương tác</span>
      <div className="flex items-center justify-between mt-0.5 gap-2" onClick={() => open && setOpen(false)}>
        <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 line-clamp-1">{display}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-52 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-0.5 mb-2">
            <button onClick={() => setRange("", "")} className={`w-full text-left px-2 py-1.5 text-[11px] rounded transition-colors ${!min && !max ? "bg-slate-50 dark:bg-slate-950 font-semibold text-emerald-600" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"}`}>Tất cả</button>
            <button onClick={() => setRange("10", "")} className={`w-full text-left px-2 py-1.5 text-[11px] rounded transition-colors ${min === "10" && !max ? "bg-slate-50 dark:bg-slate-950 font-semibold text-emerald-600" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"}`}>&gt; 10% (Rất cao)</button>
            <button onClick={() => setRange("5", "10")} className={`w-full text-left px-2 py-1.5 text-[11px] rounded transition-colors ${min === "5" && max === "10" ? "bg-slate-50 dark:bg-slate-950 font-semibold text-emerald-600" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"}`}>5% - 10% (Cao)</button>
            <button onClick={() => setRange("2", "5")} className={`w-full text-left px-2 py-1.5 text-[11px] rounded transition-colors ${min === "2" && max === "5" ? "bg-slate-50 dark:bg-slate-950 font-semibold text-emerald-600" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"}`}>2% - 5% (Trung bình)</button>
            <button onClick={() => setRange("", "2")} className={`w-full text-left px-2 py-1.5 text-[11px] rounded transition-colors ${!min && max === "2" ? "bg-slate-50 dark:bg-slate-950 font-semibold text-emerald-600" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"}`}>&lt; 2% (Thấp)</button>
          </div>
          
          <div className="border-t border-slate-100 dark:border-slate-800/60 pt-2 mt-2">
            <div className="px-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Hoặc nhập tùy chỉnh:</div>
            <div className="flex items-center gap-1.5 px-1">
              <input type="number" value={localMin} onChange={e=>setLocalMin(e.target.value)} className="w-12 h-7 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-1.5 text-center text-[11px] outline-none focus:border-emerald-500" placeholder="Từ" />
              <span className="text-slate-400 text-xs">-</span>
              <input type="number" value={localMax} onChange={e=>setLocalMax(e.target.value)} className="w-12 h-7 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-1.5 text-center text-[11px] outline-none focus:border-emerald-500" placeholder="Đến" />
              <button onClick={handleApply} className="ml-auto h-7 rounded bg-emerald-500 px-2.5 text-[10px] font-bold text-white hover:bg-emerald-600 transition">OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function YouTubeRelevanceTable() {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [filterPillar, setFilterPillar] = useState("");
  const [filterFormat, setFilterFormat] = useState("");
  const [filterErMin, setFilterErMin] = useState("");
  const [filterErMax, setFilterErMax] = useState("");
  const [page, setPage] = useState(1);

  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Dropdowns
  const [channels, setChannels] = useState<string[]>([]);
  const [pillars, setPillars] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);

  // AI scoring
  const [aiScoring, setAiScoring] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ processed: number; total: number } | null>(null);
  const [aiMessage, setAiMessage] = useState("");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      search: debouncedSearch,
      status: filterStatus,
      channel: filterChannel,
      pillar: filterPillar,
      format: filterFormat,
      engagementMin: filterErMin,
      engagementMax: filterErMax,
      page: String(page),
      limit: "10",
    });
    try {
      const res = await fetch(`/api/youtube/relevance?${params}`);
      const data = await res.json();
      setVideos(data.posts ?? []);
      setStats(data.stats ?? null);
      setPagination(data.pagination ?? { page: 1, limit: 10, total: 0, totalPages: 0 });
      setChannels(data.filters?.uniqueChannels ?? []);
      setPillars(data.filters?.uniquePillars ?? []);
      setFormats(data.filters?.uniqueFormats ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, [debouncedSearch, filterStatus, filterChannel, filterPillar, filterFormat, filterErMin, filterErMax, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, filterStatus, filterChannel, filterPillar, filterFormat, filterErMin, filterErMax]);

  const resetFilters = () => {
    setSearch("");
    setFilterStatus("");
    setFilterChannel("");
    setFilterPillar("");
    setFilterFormat("");
    setFilterErMin("");
    setFilterErMax("");
    setPage(1);
  };

  // ── Status update (single) ─────────────────────────────────────────────────
  const updateStatus = async (id: string, status: RelevanceStatus) => {
    setVideos((prev) => prev.map((v) => v.id === id ? { ...v, relevanceStatus: status } : v));
    await fetch("/api/youtube/relevance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id], status }),
    });
    // Refresh stats silently
    fetchData();
  };

  // ── Bulk actions ───────────────────────────────────────────────────────────
  const bulkUpdate = async (status: RelevanceStatus) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    await fetch("/api/youtube/relevance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), status }),
    });
    setSelected(new Set());
    setBulkLoading(false);
    fetchData();
  };

  // ── AI Scoring ─────────────────────────────────────────────────────────────
  const runAiScoring = async () => {
    setAiScoring(true);
    setAiProgress(null);
    setAiMessage("Đang kết nối với AI...");
    try {
      const res = await fetch("/api/youtube/relevance/ai-score", { method: "POST" });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data:"));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(5));
            if (data.type === "start") setAiMessage(`Tìm thấy ${data.total} video chờ chấm điểm...`);
            if (data.type === "progress") {
              setAiProgress({ processed: data.processed, total: data.total });
              setAiMessage(`Đang chấm điểm... ${data.processed}/${data.total} (${data.percent}%)`);
            }
            if (data.type === "complete") {
              setAiMessage(data.processed === 0 ? "Tất cả video đã được chấm điểm!" : `Hoàn tất: ${data.processed} video được chấm điểm.`);
              setAiProgress(null);
              fetchData();
            }
            if (data.type === "error") setAiMessage(`Lỗi: ${data.message}`);
          } catch { /* skip bad line */ }
        }
      }
    } catch (err: any) {
      setAiMessage(`Lỗi kết nối: ${err.message}`);
    }
    setAiScoring(false);
  };

  // ── Selection helpers ──────────────────────────────────────────────────────
  const allSelected = videos.length > 0 && videos.every((v) => selected.has(v.id));
  const someSelected = selected.size > 0;
  const allSelectedIrrelevant = someSelected && videos.filter((v) => selected.has(v.id)).every((v) => v.relevanceStatus === "irrelevant");

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(videos.map((v) => v.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const hasActiveFilter = !!(filterStatus || filterChannel || filterPillar || filterFormat);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-0">
      {/* Header & Filters */}
      <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
        {/* Filters (Left Side) */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
           {/* Search */}
           <div className="flex items-center gap-2 h-10 w-64 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 shadow-sm focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-200">
             <Search className="h-4 w-4 text-slate-400" />
             <input
               type="text"
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               placeholder="Tìm kiếm nội dung, tiêu đề, kênh..."
               className="h-full w-full bg-transparent text-[11px] outline-none placeholder:text-slate-400 text-slate-700 dark:text-slate-300 font-medium"
             />
           </div>

           {/* Channel */}
           <CustomSelect
             label="Kênh"
             value={filterChannel}
             onChange={setFilterChannel}
             options={channels.map((c) => ({ label: c, value: c }))}
           />

           {/* Pillar */}
           <CustomSelect
             label="Phân loại"
             value={filterPillar}
             onChange={setFilterPillar}
             options={pillars.map((p) => ({ label: p, value: p }))}
           />

           {/* Format */}
           <CustomSelect
             label="Định dạng"
             value={filterFormat}
             onChange={setFilterFormat}
             options={formats.map((f) => ({ label: formatLabels[f] ?? f, value: f }))}
           />

           {/* Relevance Status */}
           <CustomSelect
             label="Trạng thái liên quan"
             value={filterStatus}
             onChange={setFilterStatus}
             options={[
               { label: "Liên quan", value: "relevant" },
               { label: "Không liên quan", value: "irrelevant" },
               { label: "Chưa đánh giá", value: "pending" },
             ]}
           />

           {/* Engagement Rate */}
           <EngagementRateSelect
             min={filterErMin}
             max={filterErMax}
             onChange={(min, max) => {
               setFilterErMin(min);
               setFilterErMax(max);
             }}
           />

           {/* Reset Button */}
           <button
             onClick={resetFilters}
             className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300"
           >
             <RotateCcw className="h-3.5 w-3.5 text-slate-400" /> Đặt lại
           </button>
        </div>

        {/* AI scoring button (Right Side) */}
        <button
          onClick={runAiScoring}
          disabled={aiScoring}
          className="shrink-0 inline-flex h-10 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 text-[12px] font-bold text-violet-700 shadow-sm transition hover:bg-violet-100 disabled:opacity-50"
        >
          {aiScoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {aiScoring ? aiMessage : "Chạy AI phân tích"}
        </button>
      </div>

      {/* AI progress bar */}
      {aiScoring && aiProgress && (
        <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-violet-700">
            <span>{aiMessage}</span>
            <span>{aiProgress.processed}/{aiProgress.total}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-violet-200">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-300"
              style={{ width: `${Math.round((aiProgress.processed / aiProgress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary cards */}
      <SummaryCards stats={stats} loading={loading} />

      {/* Bulk action bar */}
      {someSelected && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500 text-white cursor-pointer" onClick={toggleAll}>
              <div className="h-0.5 w-2.5 bg-white dark:bg-slate-900 rounded-full"></div>
            </div>
            <div className="flex flex-col ml-1">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Đã chọn {selected.size} video</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Chọn tất cả {stats?.total || videos.length} kết quả</span>
            </div>
          </div>
          <div className="ml-4 flex flex-wrap items-center gap-2 border-l border-slate-100 dark:border-slate-800/60 pl-4">
            {allSelectedIrrelevant ? (
              <button
                onClick={() => bulkUpdate("pending")}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-500 bg-amber-50/30 px-3 py-1.5 text-[11px] font-semibold text-amber-600 transition hover:bg-amber-50 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Khôi phục
              </button>
            ) : (
              <>
                <button
                  onClick={() => bulkUpdate("relevant")}
                  disabled={bulkLoading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500 bg-emerald-50/30 px-3 py-1.5 text-[11px] font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Đánh dấu liên quan
                </button>
                <button
                  onClick={() => bulkUpdate("irrelevant")}
                  disabled={bulkLoading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-500 bg-red-50/30 px-3 py-1.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" /> Đánh dấu không liên quan
                </button>
                <button
                  onClick={() => bulkUpdate("pending")}
                  disabled={bulkLoading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <Clock className="h-3.5 w-3.5 text-slate-400" /> Chưa đánh giá
                </button>
                <button
                  onClick={() => bulkUpdate("irrelevant")}
                  disabled={bulkLoading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5 text-slate-400" /> Xóa khỏi phân tích
                </button>
              </>
            )}
          </div>
          
          <div className="ml-auto flex items-center gap-3">
             <button className="text-[11px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-1.5 bg-white dark:bg-slate-900 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                Áp dụng cho các video tương tự
                <ChevronDown className="h-3 w-3" />
             </button>
             <button onClick={() => setSelected(new Set())} className="text-slate-400 hover:text-slate-600 dark:text-slate-400">
               <X className="h-4 w-4" />
             </button>
          </div>
        </div>
      )}

      {/* Table container */}
      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-[1400px] w-full divide-y divide-kolia-line text-[12px]">
            <thead className="bg-slate-50 dark:bg-slate-950">
              <tr className="text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700 accent-kolia-green"
                  />
                </th>
                <th className="px-4 py-3 min-w-[200px]">Bài/Video</th>
                <th className="px-4 py-3 min-w-[140px]">Đối thủ</th>
                <th className="px-4 py-3 min-w-[160px]">Phân loại</th>
                <th className="px-4 py-3 min-w-[140px] text-left text-[10px] font-bold text-slate-500 dark:text-slate-400">HOOK/TONE</th>
                <th className="px-4 py-3 min-w-[140px] text-left text-[10px] font-bold text-slate-500 dark:text-slate-400">
                   <div className="flex items-center gap-1">
                      AI GỢI Ý
                      <Info className="h-3 w-3 text-slate-400" />
                   </div>
                </th>
                <th className="px-4 py-3 min-w-[130px] text-left text-[10px] font-bold text-slate-500 dark:text-slate-400">TRẠNG THÁI</th>
                <th className="w-24 px-4 py-3 text-right">Lượt xem</th>
                <th className="w-16 px-4 py-3 text-right">Like</th>
                <th className="w-20 px-4 py-3 text-right">Comment</th>
                <th className="w-28 px-4 py-3 text-right">Tỷ lệ TT</th>
                <th className="w-28 px-4 py-3">Ngày</th>
                <th className="w-16 px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kolia-line">
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-kolia-green" />
                  </td>
                </tr>
              ) : videos.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-14 text-center text-sm text-slate-400">
                    {search || hasActiveFilter ? "Không tìm thấy video phù hợp." : "Chưa có dữ liệu YouTube."}
                  </td>
                </tr>
              ) : (
                videos.map((video) => {
                  const isIrrelevant = video.relevanceStatus === "irrelevant";
                  const isRelevant = video.relevanceStatus === "relevant";
                  const isSel = selected.has(video.id);
                  return (
                    <tr
                      key={video.id}
                      className={`align-middle transition ${isSel ? "bg-kolia-mint/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"} ${isIrrelevant ? "opacity-55" : ""}`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleOne(video.id)}
                          className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700 accent-kolia-green"
                        />
                      </td>

                      {/* Thumbnail + Title */}
                      <td className="max-w-[280px] px-4 py-3">
                        <div className="flex gap-3 items-start">
                          <div className="relative h-[52px] w-[80px] shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                            {video.thumbnailUrl ? (
                              <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-300">
                                <BarChart2 className="h-5 w-5" />
                              </div>
                            )}
                            {isIrrelevant && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md">
                                <XCircle className="h-5 w-5 text-white/80" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <a
                              href={video.postUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="line-clamp-2 text-[11px] font-semibold leading-[1.35] text-kolia-ink dark:text-slate-100 hover:text-kolia-green transition"
                            >
                              {video.title}
                            </a>
                            <p className="mt-0.5 line-clamp-1 text-[9px] text-slate-400">{video.caption}</p>
                            <span className="mt-1 inline-block rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 dark:text-slate-400">
                              {formatLabels[video.format] ?? video.format}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Competitor */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[148px]">{video.competitor.name}</p>
                        <span className="mt-1 inline-flex rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600 ring-1 ring-red-200">
                          YouTube
                        </span>
                      </td>

                      {/* Phân loại */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{video.contentPillar}</p>
                        <p className="mt-0.5 text-[9px] text-slate-500 dark:text-slate-400">{video.promotionType}</p>
                        <p className="mt-0.5 text-[9px] text-kolia-green font-medium truncate max-w-[200px]">{video.mainTopic}</p>
                      </td>

                      {/* Hook/Tone */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700 dark:text-slate-300">{video.hookType}</p>
                        <p className="mt-0.5 text-[9px] text-slate-400">{video.toneOfVoice}</p>
                      </td>

                      {/* AI suggestion */}
                      <td className="px-4 py-3">
                        {aiScoreBadge(video.aiRelevanceScore, video.relevanceNote)}
                      </td>

                      {/* User status dropdown */}
                      <td className="px-4 py-3">
                        <StatusDropdown
                          videoId={video.id}
                          current={video.relevanceStatus}
                          onChange={updateStatus}
                        />
                      </td>

                      {/* Views */}
                      <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                        {formatNumber(video.views)}
                      </td>

                      {/* Like */}
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                        {formatNumber(video.likes)}
                      </td>

                      {/* Comment */}
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                        {formatNumber(video.comments)}
                      </td>

                      {/* Engagement rate */}
                      <td className="px-4 py-3 text-right font-bold text-kolia-green">
                        {formatPercent(video.engagementRate)}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {formatDate(video.publishedAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <a
                            href={video.postUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded p-1 text-slate-400 hover:text-kolia-green transition"
                            title="Mở video trên YouTube"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          {isIrrelevant && (
                            <button
                              onClick={() => updateStatus(video.id, "pending")}
                              className="rounded p-1 text-slate-400 hover:text-amber-500 transition"
                              title="Khôi phục — đưa về chưa đánh giá"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {!isIrrelevant && (
                            <button
                              onClick={() => updateStatus(video.id, "relevant")}
                              className="rounded p-1 text-slate-400 hover:text-emerald-500 transition"
                              title="Đánh dấu liên quan"
                            >
                              <BookmarkCheck className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {isRelevant && (
                            <button
                              onClick={() => updateStatus(video.id, "irrelevant")}
                              className="rounded p-1 text-slate-400 hover:text-red-500 transition"
                              title="Đánh dấu không liên quan"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-kolia-line dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span>
            Hiển thị {pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} trong{" "}
            <span className="font-semibold text-kolia-ink dark:text-slate-100">{pagination.total}</span> kết quả
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-6 w-6 items-center justify-center rounded border border-kolia-line dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 disabled:opacity-30 transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
              const totalPgs = pagination.totalPages;
              let pageNum: number;
              if (totalPgs <= 7) { pageNum = i + 1; }
              else {
                const start = Math.max(1, Math.min(page - 3, totalPgs - 6));
                pageNum = start + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`flex h-6 min-w-[24px] items-center justify-center rounded px-1 text-[11px] font-semibold transition ${
                    pageNum === page ? "bg-kolia-green text-white" : "border border-kolia-line dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages || pagination.totalPages === 0}
              className="flex h-6 w-6 items-center justify-center rounded border border-kolia-line dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 disabled:opacity-30 transition"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
