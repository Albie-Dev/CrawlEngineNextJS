"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Eye,
  Clock,
  Calendar,
  Check,
  Loader2,
  X,
  Play,
  ExternalLink,
  ChevronDown
} from "lucide-react";

type Segment = {
  time: string;
  title: string;
  color: string;
  text: string;
};

type VideoData = {
  id: string;
  url?: string;
  title: string;
  channel: string;
  category: string;
  duration: string;
  views: string;
  published: string;
  outlierScore: number;       // Thang 100: 20=baseline, 40=vượt trội, 60=outlier, 80=siêu outlier
  outlierLabel: string;        // Phân loại: "Dưới TB" | "Baseline" | "Vượt trội" | "Outlier" | "Siêu Outlier"
  recommendation: "Đề xuất cao" | "Tiềm năng";
  topicTag: string;
  thumbnail: string;
  format: string;
  mainTopic: string;
  transcript: string;
  isDeepAnalysis?: boolean;
  // Sections
  formatViral?: {
    titleTemplate: string;
    hookPattern: string;
    corePromise: string;
    contentAngle: string;
    style: string;
  };
  segments?: Segment[];
  bullets?: string[];
  effects?: string[];
  brief?: {
    topic: string;
    angle: string;
    keyPoints: string;
    cta: string;
  };
  vietnamComparison?: {
    quickVerdict: string;
    quickVerdictDesc: string;
    table: Array<{
      channel: string;
      topic: string;
      views: string;
      efficiency: "Trung bình" | "Thấp" | "Cao";
      date: string;
    }>;
  };
  summary?: string;
  highlights?: Array<{
    timestamp: string;
    timeRange?: string;
    title: string;
    detail: string;
  }>;
  tags?: string[];
  channelProfile?: {
    contentStyle: string;
    targetAudience: string;
    strengths: string;
    worthFollowing: "Có" | "Không" | "Tuỳ mục đích";
    reason: string;
  };
  /** @deprecated Kept for backward compat, use channelProfile */
  channelDesc?: string;
};

function formatViews(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
}

function estimateDuration(p: any): string {
  if (p.transcript) {
    const cleanText = p.transcript.replace(/\[\d{1,2}:\d{2}\]/g, ""); // strip timestamps if any
    const wordCount = cleanText.trim().split(/\s+/).length;
    if (wordCount > 5) {
      const totalSeconds = Math.round(wordCount / 2.2); // ~130 words per minute
      if (p.format === "short_video" || p.format === "reel") {
        const seconds = Math.min(59, Math.max(5, totalSeconds));
        return `0:${String(seconds).padStart(2, "0")}`;
      } else {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
      }
    }
  }

  // Fallback pseudorandom stable duration based on title/id
  const hash = p.id.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
  if (p.format === "short_video" || p.format === "reel") {
    const seconds = 7 + (hash % 38);
    return `0:${String(seconds).padStart(2, "0")}`;
  }
  const minutes = 8 + (hash % 15);
  const seconds = hash % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(p: any): string {
  if (p.duration !== null && p.duration !== undefined && p.duration > 0) {
    const mins = Math.floor(p.duration / 60);
    const secs = p.duration % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }
  return estimateDuration(p);
}




function TranscriptTabContent({ transcript }: { transcript: string }) {
  const [isBilingual, setIsBilingual] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState(false);

  if (!transcript || transcript.trim() === "") {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-slate-150 bg-slate-50/60 p-5 text-sm font-medium text-slate-500">
        Không có dữ liệu transcript cho video này.
      </div>
    );
  }

  // Nếu transcript có định dạng JSON/Array (từ API), tạm thời hiển thị raw string
  let isJson = false;
  try {
    const parsed = JSON.parse(transcript);
    if (typeof parsed === "object") isJson = true;
  } catch (e) {
    isJson = false;
  }

  if (isJson) {
    return (
      <div className="rounded-lg border border-slate-150 bg-slate-50/60 p-5 text-xs text-slate-600 font-mono whitespace-pre-wrap h-[400px] overflow-y-auto custom-scrollbar">
        {transcript}
      </div>
    );
  }

  // Xử lý phân giải dòng và mốc thời gian
  const rawLines = transcript.split("\n").map(l => l.trim()).filter(Boolean);
  const hasTimestamps = rawLines.some(line => /^\s*\[?\d{1,2}:\d{2}\]?/.test(line));

  const parsedLines: { time: string; text: string }[] = [];
  
  if (hasTimestamps) {
    rawLines.forEach(line => {
      const match = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.*)$/);
      if (match) {
        parsedLines.push({ time: match[1], text: match[2] });
      } else {
        parsedLines.push({ time: "", text: line });
      }
    });
  } else {
    // Nhóm 3 câu thành 1 đoạn nếu không có mốc thời gian sẵn
    const sentences = transcript.match(/[^.!?]+[.!?]+(\s|$)/g) || [transcript];
    const paragraphs: string[][] = [];
    for (let i = 0; i < sentences.length; i += 3) {
      paragraphs.push(sentences.slice(i, i + 3));
    }
    paragraphs.forEach((p, index) => {
      const minutes = Math.floor((index * 30) / 60);
      const seconds = (index * 30) % 60;
      const simTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      parsedLines.push({ time: simTime, text: p.join("") });
    });
  }

  const handleToggleBilingual = async () => {
    const nextState = !isBilingual;
    setIsBilingual(nextState);

    if (nextState && Object.keys(translations).length === 0) {
      setIsTranslating(true);
      try {
        // Chỉ dịch 15 đoạn đầu để tối ưu tốc độ và token
        const textsToTranslate = parsedLines.slice(0, 15).map(l => l.text).filter(t => t.trim().length > 0);
        
        if (textsToTranslate.length > 0) {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts: textsToTranslate })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.translated && Array.isArray(data.translated)) {
              const newTrans: Record<number, string> = {};
              let translateIdx = 0;
              // Map lại kết quả dịch dựa trên index của parsedLines hợp lệ
              parsedLines.slice(0, 15).forEach((line, idx) => {
                if (line.text.trim().length > 0 && data.translated[translateIdx]) {
                  newTrans[idx] = data.translated[translateIdx];
                  translateIdx++;
                }
              });
              setTranslations(newTrans);
            }
          }
        }
      } catch (error) {
        console.error("Lỗi dịch:", error);
      }
      setIsTranslating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 sticky top-0 bg-white/80 backdrop-blur pb-2 z-10 border-b border-slate-150 pt-2">
        <h3 className="font-bold text-base text-kolia-ink">Subtitles</h3>
        <div className="flex items-center gap-2">
          {/* Copy raw transcript button */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(transcript);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
            title="Copy raw transcript (cả timeline)"
          >
            {copied ? (
              <>
                <svg className="h-3 w-3 text-kolia-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-kolia-green">Đã copy</span>
              </>
            ) : (
              <>
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copy raw</span>
              </>
            )}
          </button>

          {isTranslating && <span className="text-[10px] text-slate-400 font-medium italic">Đang dịch...</span>}
          <div
            className={`flex items-center gap-1.5 transition-colors ${
              isBilingual ? "text-violet-600" : "text-slate-500"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 8 6 6" />
              <path d="m4 14 6-6 2-3" />
              <path d="M2 5h12" />
              <path d="M7 2h1" />
              <path d="m22 22-5-10-5 10" />
              <path d="M14 18h6" />
            </svg>
            <span className="text-[12px] font-semibold">Bilingual</span>
          </div>
          <button
            onClick={handleToggleBilingual}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none ${
              isBilingual ? "bg-kolia-purple" : "bg-slate-200"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                isBilingual ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="space-y-5 text-[13px] font-sans">
        {parsedLines.map((line, index) => {
          const viText = translations[index];
          // Ẩn block nếu không có time và text
          if (!line.time && !line.text.trim()) return null;

          return (
            <div key={index} className="flex gap-4 items-start">
              <span className="font-medium text-violet-500 shrink-0 select-none w-10 pt-0.5">
                {line.time}
              </span>
              <div className="flex-1">
                <p className="text-slate-800 leading-relaxed">
                  {line.text}
                </p>
                {isBilingual && line.text.trim().length > 0 && (
                  <p className="text-slate-500 leading-relaxed mt-0.5 text-[13px] underline decoration-dotted decoration-slate-400/70 underline-offset-[3px]">
                    {viText || (isTranslating ? "..." : (index >= 15 ? "(Bản dịch bị giới hạn ở 15 dòng đầu)" : ""))}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/**
 * Helper: phân loại outlier score (thang 100) thành nhãn trực quan
 */
function outlierLabel(score: number): string {
  if (score >= 80) return "Siêu Outlier";
  if (score >= 60) return "Outlier";
  if (score >= 40) return "Vượt trội";
  if (score >= 20) return "Baseline";
  return "Dưới TB";
}

/** Extract YouTube video ID from various YouTube URL formats */
function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart Vietnam Comparison - Level 1+2+3 (Fuzzy + Dynamic + Smart Sort)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fuzzy matching: Check if two strings are similar
 * - Exact match: 100 points
 * - Contains match: 70 points
 * - Partial match (2+ words): 40 points
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;
  if (s1.includes(s2) || s2.includes(s1)) return 70;

  // Check partial word match (at least 2 words)
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(w => w.length > 2 && words2.includes(w));
  if (commonWords.length >= 2) return 40;
  if (commonWords.length === 1) return 20;

  return 0;
}

/**
 * Calculate relevance score for a post compared to foreign video
 * - Topic similarity: 50% weight
 * - Category match: 30% weight
 * - Title similarity: 20% weight
 */
function calculateRelevanceScore(
  post: any,
  foreignTopic: string,
  foreignCategory: string
): number {
  const topicSimilarity = calculateSimilarity(post.mainTopic || "", foreignTopic);
  const categoryMatch = post.contentPillar === foreignCategory ? 100 :
                       calculateSimilarity(post.contentPillar || "", foreignCategory);
  const titleSimilarity = calculateSimilarity(post.title || "", foreignTopic);

  return Math.round(topicSimilarity * 0.5 + categoryMatch * 0.3 + titleSimilarity * 0.2);
}

/**
 * Calculate efficiency level with dynamic threshold
 * - Uses median engagement rate of domestic posts as baseline
 * - High: >= median * 1.2
 * - Medium: >= median * 0.8
 * - Low: < median * 0.8
 */
function calculateEfficiencyLevel(
  engagementRate: number,
  domesticPosts: any[]
): "Cao" | "Trung bình" | "Thấp" {
  const domesticRates = domesticPosts
    .filter(p => p.competitor?.source === "trong_nuoc" && typeof p.engagementRate === "number")
    .map(p => p.engagementRate);

  if (domesticRates.length === 0) {
    // Fallback to hardcoded threshold if no data
    return engagementRate >= 0.05 ? "Cao" : engagementRate >= 0.02 ? "Trung bình" : "Thấp";
  }

  // Calculate median
  const sorted = domesticRates.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  if (engagementRate >= median * 1.2) return "Cao";
  if (engagementRate >= median * 0.8) return "Trung bình";
  return "Thấp";
}

function getVietnamComparison(videoTopic: string, videoCategory: string, allPosts: any[], limit: number = 10) {
  // Pre-filter domestic posts
  const domesticPosts = allPosts.filter(p => p.competitor?.source === "trong_nuoc");

  // Calculate relevance scores for all domestic posts
  const scored = domesticPosts
    .map(p => ({
      post: p,
      relevanceScore: calculateRelevanceScore(p, videoTopic, videoCategory),
      efficiencyRate: p.engagementRate || 0
    }))
    .filter(item => item.relevanceScore >= 30); // Only keep posts with relevance >= 30%

  // Smart sort: relevance (60%) + efficiency (40%)
  // Normalize efficiency to 0-100 scale (assuming 0-10% range)
  const scoredWithCombined = scored.map(item => ({
    ...item,
    combinedScore: item.relevanceScore * 0.6 + Math.min(item.efficiencyRate * 1000, 100) * 0.4
  }));

  // Sort by combined score and take top N
  const topCandidates = scoredWithCombined
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, limit);

  // Build table with additional metadata
  const table = topCandidates.map(item => {
    const efficiency = calculateEfficiencyLevel(item.efficiencyRate, domesticPosts);
    return {
      channel: item.post.competitor?.name || "Kênh Việt",
      channelAvatar: item.post.competitor?.avatarUrl || item.post.competitor?.logo || "",
      topic: item.post.title,
      views: formatViews(item.post.views),
      efficiency,
      efficiencyRate: item.efficiencyRate, // Raw value for debugging
      date: new Date(item.post.publishedAt).toLocaleDateString("vi-VN"),
      relevanceScore: item.relevanceScore,
      combinedScore: item.combinedScore,
      postId: item.post.id, // Add for click handling
      postUrl: item.post.postUrl, // Add for external link
      thumbnailUrl: item.post.thumbnailUrl || ""
    };
  });

  // Generate verdict based on results
  let quickVerdict = "Cơ hội tốt cho nhà sáng tạo Việt Nam";
  let quickVerdictDesc = "Chủ đề này chưa bị khai thác nhiều tại thị trường Việt Nam.";
  const totalMatches = scoredWithCombined.length; // Total available matches

  if (table.length === 0) {
    quickVerdict = "Thị trường ngách xanh mướt (Blue Ocean)";
    quickVerdictDesc = "Ở VN chưa ai làm chủ đề này, cơ hội cực lớn để đi tiên phong!";
  } else {
    const hasHighEfficiency = table.some((r) => r.efficiency === "Cao");
    const avgRelevance = table.reduce((sum, r) => sum + r.relevanceScore, 0) / table.length;

    if (hasHighEfficiency && avgRelevance >= 70) {
      quickVerdict = "Chủ đề siêu Hot (Red Ocean)";
      quickVerdictDesc = "Đã có kênh VN làm rất thành công với chủ đề tương tự, độ cạnh tranh cao.";
    } else if (hasHighEfficiency) {
      quickVerdict = "Đã có cạnh tranh";
      quickVerdictDesc = "Một số kênh VN đang làm và có hiệu quả tốt, cần tìm angle mới để khác biệt hóa.";
    } else {
      quickVerdict = "Có người làm nhưng chưa tới";
      quickVerdictDesc = "Chủ đề đã xuất hiện ở VN nhưng chưa bùng nổ, bạn có thể làm tốt hơn nhờ format từ nước ngoài.";
    }
  }

  return { quickVerdict, quickVerdictDesc, table, totalMatches, hasMore: totalMatches > limit };
}

function HighlightsTabContent({
  summary,
  highlights
}: {
  summary?: string;
  highlights: Array<{ timestamp: string; timeRange?: string; title: string; detail: string }>;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [isAllExpanded, setIsAllExpanded] = useState(false);

  const toggleAll = () => {
    const nextState = !isAllExpanded;
    setIsAllExpanded(nextState);
    const newExpanded: Record<number, boolean> = {};
    highlights.forEach((_, i) => {
      newExpanded[i] = nextState;
    });
    setExpanded(newExpanded);
  };

  const toggleOne = (idx: number) => {
    setExpanded((prev) => {
      const next = { ...prev, [idx]: !prev[idx] };
      // Check if all are expanded now
      const allOpen = highlights.every((_, i) => next[i]);
      setIsAllExpanded(allOpen);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {summary && (
        <div className="text-[13px] leading-relaxed text-slate-700 bg-white p-4 rounded-lg border border-slate-150 shadow-2xs">
          {summary}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-kolia-ink">Highlights</h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium">Expand all</span>
            <button
              onClick={toggleAll}
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none ${
                isAllExpanded ? "bg-kolia-purple" : "bg-slate-200"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  isAllExpanded ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        <ul className="space-y-0 relative before:absolute before:inset-y-0 before:left-[30px] before:w-px before:bg-slate-150">
          {highlights.map((hl, i) => {
            const isExpanded = expanded[i] || false;
            return (
              <li key={i} className="relative flex gap-4 pt-1 pb-5 last:pb-0">
                <div className="w-[60px] shrink-0 pt-0.5 relative z-10 bg-white">
                  <span className="text-[12px] font-medium text-kolia-purple">{hl.timestamp || "00:00"}</span>
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-[13px] text-slate-800 font-semibold leading-relaxed mb-1.5">{hl.title}</p>
                  
                  {isExpanded && (hl.detail || hl.timeRange) && (
                    <div className="text-[12px] text-slate-500 leading-relaxed mb-2 pb-2 border-b border-slate-50">
                      {hl.timeRange && (
                        <div className="mb-1 font-medium text-slate-600 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Timeline: {hl.timeRange}
                        </div>
                      )}
                      {hl.detail}
                    </div>
                  )}

                  <button
                    onClick={() => toggleOne(i)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 font-medium flex items-center gap-1 transition-colors"
                  >
                    {isExpanded ? "Collapse" : "Click to expand"}
                    <svg
                      className={`w-3 h-3 transform transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline filter select (giống FilterBar.tsx nhưng compact)
// ─────────────────────────────────────────────────────────────────────────────

function FilterSelectInline({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div
      ref={ref}
      className="relative h-8 min-w-[130px] flex-1 rounded border border-slate-200 bg-white shadow-xs flex items-center cursor-pointer select-none hover:border-slate-300 transition"
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between gap-1.5 w-full px-2.5">
        <span className="text-[10px] font-medium text-slate-700 truncate">{selected?.label}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute left-0 top-full z-50 w-full min-w-[150px] mt-0.5 rounded border border-slate-200 bg-white py-1 shadow-lg max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`px-3 py-1.5 text-[11px] cursor-pointer transition-colors hover:bg-slate-50 ${
                value === opt.value ? "bg-slate-50 font-semibold text-kolia-green" : "text-slate-700"
              }`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function YouTubeForeignAnalysis({ domesticPosts = [], variant = "foreign", initialFormat = "" }: { domesticPosts?: any[]; variant?: "foreign" | "domestic"; initialFormat?: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [videoList, setVideoList] = useState<VideoData[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "transcript" | "highlights" | "tags" | "channel">("overview");
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilter, setShowFilter] = useState(false);
  const [filterTopic, setFilterTopic] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [filterFormat, setFilterFormat] = useState(initialFormat);
  const [loadingList, setLoadingList] = useState(true);

  // Sync internal filter state when initialFormat prop changes (e.g. navigation)
  useEffect(() => {
    setFilterFormat(initialFormat);
    setCurrentPage(1);
  }, [initialFormat]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [uniqueTopics, setUniqueTopics] = useState<string[]>([]);
  const [uniqueChannels, setUniqueChannels] = useState<string[]>([]);
  const [showMoreVietnamVideos, setShowMoreVietnamVideos] = useState(false);
  const [vietnamVideosFullData, setVietnamVideosFullData] = useState<any>(null);
  const [selectedVietnamVideoIdx, setSelectedVietnamVideoIdx] = useState(0);

  // ── Fetch from API when search/filter/page changes ────────────────
  useEffect(() => {
    setLoadingList(true);
    const params = new URLSearchParams({
      search: searchTerm,
      topic: filterTopic,
      channel: filterChannel,
      format: filterFormat,
      page: String(currentPage),
      limit: "10",
    });
    const apiPath = variant === "domestic" ? "/api/youtube/domestic-analysis" : "/api/youtube/foreign-analysis";
    fetch(`${apiPath}?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const mapped = data.posts.map((p: any) => {
          const mainTopic = p.mainTopic || "Tài chính";
          const category = p.contentPillar || "Tài chính";
          const score = data.outlierScores[p.id] ?? 20;

          let aiData = null;
          if (p.aiAnalysis) {
            try { aiData = JSON.parse(p.aiAnalysis); } catch (e) {}
          }

          return {
            id: p.id,
            title: p.title,
            channel: p.competitor?.name || "Kênh đối thủ",
            category,
            duration: formatDuration(p),
            views: formatViews(p.views),
            published: new Date(p.publishedAt).toLocaleDateString("vi-VN"),
            outlierScore: score,
            outlierLabel: outlierLabel(score),
            recommendation: (score >= 60 ? "Đề xuất cao" : "Tiềm năng") as any,
            topicTag: score >= 80 ? "View bùng nổ" : score >= 60 ? "Topic mới / view cao" : score >= 40 ? "Tiềm năng khai thác" : "Theo dõi thêm",
            thumbnail: p.thumbnailUrl || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=300&auto=format&fit=crop",
            format: p.format,
            mainTopic,
            transcript: p.transcript || "Chưa có bản dịch cho video này.",
            url: p.postUrl || `https://www.youtube.com/watch?v=${p.id}`,
            vietnamComparison: variant === "domestic" ? undefined : getVietnamComparison(mainTopic, category, domesticPosts),
            ...(aiData ? {
              isDeepAnalysis: aiData.isDeepAnalysis,
              formatViral: aiData.formatViral,
              segments: aiData.timeline?.length
                ? aiData.timeline.map((item: any, i: number) => ({
                    time: item.time,
                    title: item.title,
                    color: ["bg-purple-100 border-purple-300 text-purple-700", "bg-blue-100 border-blue-300 text-blue-700", "bg-teal-100 border-teal-300 text-teal-700", "bg-green-100 border-green-300 text-green-700", "bg-rose-100 border-rose-300 text-rose-700"][i % 5],
                    text: item.title
                  }))
                : [],
              bullets: aiData.timeline?.length ? aiData.timeline.map((item: any) => `${item.time}: ${item.script}`) : [],
              effects: aiData.editingAndEffects,
              brief: aiData.contentBrief,
              summary: aiData.summary,
              highlights: aiData.highlights || [],
              tags: aiData.tags || [],
              channelProfile: aiData.channelProfile,
            } : {})
          };
        });

        setVideoList(mapped);
        setPagination(data.pagination);
        setUniqueTopics(data.filters.uniqueTopics);
        setUniqueChannels(data.filters.uniqueChannels);

        // Auto-select first video
        setSelectedVideo((prev) => {
          if (mapped.length > 0 && mapped.some((v: VideoData) => v.id === prev?.id)) return prev;
          return mapped[0] || null;
        });

        setLoadingList(false);
      })
      .catch(() => setLoadingList(false));
  }, [searchTerm, filterTopic, filterChannel, filterFormat, currentPage]);

  // Handle manual re-analyze
  const handleReanalyze = async (isDeepAnalysis: boolean = false) => {
    if (!selectedVideo) return;
    setLoadingAnalysis(true);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: selectedVideo.id,
          forceReanalyze: true,
          isDeepAnalysis
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

      updateSelectedVideoWithAiData(data);
    } catch (err: any) {
      setAnalysisError(err.message || "Có lỗi xảy ra khi phân tích.");
      setLoadingAnalysis(false);
    }
  };

  const updateSelectedVideoWithAiData = (data: any) => {
    const enriched: Partial<VideoData> = {
      isDeepAnalysis: data.isDeepAnalysis,
      formatViral: data.formatViral || {
        titleTemplate: "Chưa phân tích được",
        hookPattern: "Chưa phân tích được",
        corePromise: "Chưa phân tích được",
        contentAngle: "Chưa phân tích được",
        style: "Chưa phân tích được"
      },
      segments: data.timeline && data.timeline.length > 0
        ? data.timeline.map((item: any, i: number) => ({
            time: item.time,
            title: item.title,
            color: ["bg-purple-100 border-purple-300 text-purple-700", "bg-blue-100 border-blue-300 text-blue-700", "bg-teal-100 border-teal-300 text-teal-700", "bg-green-100 border-green-300 text-green-700", "bg-rose-100 border-rose-300 text-rose-700"][i % 5],
            text: item.title
          }))
        : [],
      bullets: data.timeline && data.timeline.length > 0
        ? data.timeline.map((item: any) => `${item.time}: ${item.script}`)
        : ["Đang cập nhật các bước phân tích..."],
      effects: data.editingAndEffects && data.editingAndEffects.length > 0 
        ? data.editingAndEffects 
        : ["B-roll", "Zoom cut nhanh", "Hiệu ứng âm thanh"],
      brief: data.contentBrief || {
        topic: selectedVideo!.title,
        angle: `Khai thác khía cạnh ${selectedVideo!.mainTopic}`,
        keyPoints: "Chưa phân tích được",
        cta: data.vietnamized || "Đăng ký kênh để theo dõi cập nhật!"
      },
      vietnamComparison: variant === "domestic" ? undefined : getVietnamComparison(selectedVideo!.mainTopic, selectedVideo!.category, domesticPosts),
      summary: data.summary,
      highlights: data.highlights && data.highlights.length > 0 ? data.highlights : [],
      tags: data.tags && data.tags.length > 0 ? data.tags : [selectedVideo!.mainTopic],
      channelProfile: data.channelProfile,
    };

    setSelectedVideo((prev) => (prev ? { ...prev, ...enriched } : null));
    
    // Đồng bộ update lại videoList để lần sau click không phải load lại
    setVideoList((prev) => 
      prev.map(v => v.id === selectedVideo!.id ? { ...v, ...enriched } : v)
    );

    setLoadingAnalysis(false);
  };

  // Load AI Analysis on demand for database-sourced videos
  useEffect(() => {
    if (!selectedVideo || selectedVideo.formatViral) {
      return;
    }

    setLoadingAnalysis(true);
    setAnalysisError(null);
    
    fetch("/api/analyze-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: selectedVideo.id })
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        return data;
      })
      .then((data) => {
        updateSelectedVideoWithAiData(data);
      })
      .catch((err) => {
      });
  }, [selectedVideo?.id]);

  // Reset page when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterTopic, filterChannel, filterFormat]);

  const itemsPerPage = 10;
  const totalItems = pagination.total;
  const totalPages = pagination.totalPages;
  const displayedVideos = videoList;

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr] h-[850px]">
      {/* Left Block (List, Search & Paging) */}
      <div className="flex flex-col h-full rounded border border-kolia-line bg-white overflow-hidden shadow-xs">
        {/* Left Block Header: Search & Filter */}
        <div className="flex flex-col border-b border-kolia-line bg-slate-50/50">
          <div className="flex items-center gap-2 p-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm video, kênh, chủ đề..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-kolia-ink placeholder-slate-400 focus:border-kolia-green focus:outline-none"
              />
            </div>
            <button
              onClick={() => setShowFilter((f) => !f)}
              className={`inline-flex items-center gap-1 rounded border px-2.5 py-1.5 text-xs font-semibold shadow-2xs transition ${
                showFilter || filterTopic || filterChannel || filterFormat
                  ? "border-kolia-green bg-kolia-green text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Filter className="h-3 w-3" />
              Bộ lọc
              {(filterTopic || filterChannel || filterFormat) && (
                <span className="ml-0.5 rounded bg-white/20 px-1 text-[9px] font-bold">{+!!filterTopic + +!!filterChannel + +!!filterFormat}</span>
              )}
            </button>
          </div>

          {/* Filter dropdown panel */}
          {showFilter && (
            <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-0">
              {/* Format filter */}
              <FilterSelectInline
                value={filterFormat}
                onChange={setFilterFormat}
                options={[
                  { value: "", label: "Tất cả độ dài" },
                  { value: "short_video", label: "Short video" },
                  { value: "long_video", label: "Long video" },
                ]}
              />
              {/* Topic filter */}
              <FilterSelectInline
                value={filterTopic}
                onChange={setFilterTopic}
                options={[
                  { value: "", label: "Tất cả chủ đề" },
                  ...uniqueTopics.map((t) => ({ value: t, label: t })),
                ]}
              />
              {/* Channel filter */}
              <FilterSelectInline
                value={filterChannel}
                onChange={setFilterChannel}
                options={[
                  { value: "", label: "Tất cả kênh" },
                  ...uniqueChannels.map((c) => ({ value: c, label: c })),
                ]}
              />
              {/* Clear filter */}
              {(filterTopic || filterChannel || filterFormat) && (
                <button
                  onClick={() => { setFilterTopic(""); setFilterChannel(""); setFilterFormat(""); }}
                  className="shrink-0 rounded border border-red-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-red-500 hover:bg-red-50 transition"
                >
                  Xoá
                </button>
              )}
            </div>
          )}
        </div>

        {/* Left Block Content: Scrollable list of video cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {loadingList ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-kolia-green" />
            </div>
          ) : displayedVideos.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">{variant === "domestic" ? "Không tìm thấy video trong nước nào" : "Không tìm thấy video đối thủ nước ngoài nào"}</div>
          ) : displayedVideos.map((video, idx) => {
            const globalIndex = (currentPage - 1) * itemsPerPage + idx + 1;
            const isSelected = selectedVideo?.id === video.id;
            return (
              <div
                key={video.id}
                onClick={() => {
                  setSelectedVideo(video);
                  setActiveTab("overview");
                }}
                className={`group flex cursor-pointer gap-3 rounded-lg border p-2.5 bg-white transition hover:shadow-sm ${
                  isSelected ? "border-kolia-green bg-emerald-50/20 shadow-sm" : "border-kolia-line hover:border-slate-300"
                }`}
              >
                {/* Thumbnail */}
                <div className="relative h-[72px] w-[112px] shrink-0 overflow-hidden rounded-md bg-slate-100">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  {/* Duration badge */}
                  <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">
                    {video.duration}
                  </span>
                  {/* Index badge at bottom-left */}
                  <span className="absolute bottom-1 left-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black/75 text-[9px] font-bold text-white leading-none">
                    {globalIndex}
                  </span>
                </div>

                {/* Info */}
                <div className="flex flex-col min-w-0 flex-1 py-0.5 gap-1">
                  {/* Title */}
                  <h3 className="line-clamp-2 text-[11px] font-semibold leading-[1.35] text-kolia-ink group-hover:text-kolia-green transition">
                    {video.title}
                  </h3>

                  {/* Channel */}
                  <div className="flex items-center gap-1">
                    <span className="truncate text-[10px] text-slate-500 font-medium">{video.channel}</span>
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-sky-400 fill-sky-400 stroke-white" />
                  </div>

                  {/* Category */}
                  <span className="truncate text-[9px] text-slate-400">{video.category}</span>

                  {/* Row 3: Views · Outlier Score · Recommendation */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Views */}
                    <span className="inline-flex items-center gap-1 text-[9px] text-slate-500">
                      <Eye className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                      <span className="font-medium">{video.views}</span>
                    </span>
                    <span className="text-slate-200 text-[10px]">|</span>
                    {/* Outlier Score */}
                    <span className="inline-flex items-center gap-0.5 text-[9px]">
                      <span className="font-extrabold text-kolia-green">{video.outlierScore}</span>
                      <span className="text-slate-400 font-normal">Outlier</span>
                    </span>
                    <span className="text-slate-200 text-[10px]">|</span>
                    {/* Recommendation badge */}
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                        video.recommendation === "Đề xuất cao"
                          ? "bg-emerald-50 text-kolia-green border border-emerald-200"
                          : "bg-amber-50 text-amber-600 border border-amber-200"
                      }`}
                    >
                      <Sparkles className="h-2 w-2" />
                      {video.recommendation}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Left Block Footer: Pagination */}
        <div className="p-3 border-t border-kolia-line bg-slate-50/50 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 select-none">
          <span>
            Hiển thị {totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-
            {Math.min(currentPage * itemsPerPage, totalItems)} trong {totalItems} kết quả
          </span>

          <div className="flex items-center gap-1 overflow-x-auto max-w-[280px] custom-scrollbar">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-slate-200/60 disabled:opacity-30 shrink-0 transition"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>

            {(() => {
              const pages: (number | "...")[] = [];
              const range = 2; // số trang hiển thị 2 bên trang hiện tại

              if (totalPages <= 7) {
                // Nếu ít trang, hiển thị tất cả
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);

                if (currentPage - range > 2) pages.push("...");

                const start = Math.max(2, currentPage - range);
                const end = Math.min(totalPages - 1, currentPage + range);
                for (let i = start; i <= end; i++) pages.push(i);

                if (currentPage + range < totalPages - 1) pages.push("...");

                pages.push(totalPages);
              }

              return pages.map((p, idx) => {
                if (p === "...") {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-0.5 text-slate-400 font-bold tracking-widest">
                      ...
                    </span>
                  );
                }
                const isCurrent = currentPage === p;
                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`h-5 w-5 rounded font-bold text-center text-[11px] leading-none transition ${
                      isCurrent
                        ? "bg-kolia-ink text-white"
                        : "hover:bg-slate-200/60 text-slate-600"
                    }`}
                  >
                    {p}
                  </button>
                );
              });
            })()}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1 rounded hover:bg-slate-200/60 disabled:opacity-30 shrink-0 transition"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Block (Details Pane) */}
      <div className="flex flex-col h-full rounded border border-kolia-line bg-white shadow-xs overflow-hidden">
        {selectedVideo ? (
          <>
            {/* Header Video Detail */}
            <div className="border-b border-kolia-line bg-white shrink-0">
              <div className="flex gap-4 p-4 items-start">
                {/* Thumbnail — clickable link */}
                <a
                  href={selectedVideo.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="relative h-[110px] w-[176px] shrink-0 overflow-hidden rounded-lg bg-slate-100 border border-slate-200 shadow-sm group block"
                >
                  <img
                    src={selectedVideo.thumbnail}
                    alt={selectedVideo.title}
                    className="h-full w-full object-cover group-hover:brightness-90 transition"
                  />
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                    {selectedVideo.duration}
                  </span>
                </a>

                {/* Title & Info */}
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  {/* Title — clickable link */}
                  <a
                    href={selectedVideo.url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[15px] font-bold leading-snug text-kolia-ink line-clamp-2 hover:text-kolia-green hover:underline transition"
                  >
                    {selectedVideo.title}
                  </a>

                  {/* Channel */}
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
                      {selectedVideo.channel.slice(0, 1)}
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{selectedVideo.channel}</span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-sky-400 fill-sky-400 stroke-white shrink-0" />
                  </div>

                  {/* Single Stats Row: Views | Duration | Date | Score | Topic tag — all in one line */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    {/* Views */}
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3 shrink-0" />
                      <span className="font-semibold text-slate-700">{selectedVideo.views}</span>
                      <span>lượt xem</span>
                    </span>

                    <span className="text-slate-200">|</span>

                    {/* Duration */}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{selectedVideo.duration}</span>
                    </span>

                    <span className="text-slate-200">|</span>

                    {/* Date */}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>{selectedVideo.published}</span>
                    </span>

                    <span className="text-slate-200">|</span>

                    {/* Outlier Score */}
                    <span className="flex items-center gap-1">
                      <span className="text-base font-extrabold text-kolia-green leading-none">{selectedVideo.outlierScore}</span>
                      <span className="text-slate-400">/100</span>
                      <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 whitespace-nowrap">Outlier Score</span>
                    </span>

                    <span className="text-slate-200">|</span>

                    {/* Topic tag badge */}
                    <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 whitespace-nowrap">
                      {selectedVideo.topicTag || "Topic mới / view cao"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-kolia-line bg-slate-50/50 px-4 shrink-0">
              {[
                { id: "overview", label: "Tổng quan" },
                { id: "transcript", label: "Transcript AI" },
                { id: "highlights", label: "Highlights" },
                { id: "tags", label: "Chủ đề & Tags" },
                { id: "channel", label: "Kênh" }
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`border-b-2 py-2.5 px-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition ${
                      isActive
                        ? "border-kolia-green text-kolia-green"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Contents (Scrollable Container) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-white">
              {loadingAnalysis ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2.5">
                  <Loader2 className="h-7 w-7 animate-spin text-kolia-green" />
                  <p className="text-xs font-semibold text-slate-500">AI đang tiến hành phân tích kịch bản & cấu trúc video...</p>
                </div>
              ) : analysisError ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2.5">
                  <span className="text-2xl">⚠️</span>
                  <p className="text-xs font-semibold text-red-500 text-center max-w-md">{analysisError}</p>
                  <button
                    onClick={() => {
                      setAnalysisError(null);
                      setSelectedVideo((prev) => prev ? { ...prev } : null);
                    }}
                    className="mt-2 text-xs text-kolia-green underline hover:no-underline"
                  >
                    Thử lại
                  </button>
                </div>
              ) : activeTab === "overview" && selectedVideo.formatViral ? (
                <div className="grid grid-cols-2 gap-5">
                  {/* Banner / Button Reanalyze — full width */}
                  <div className="col-span-2 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-kolia-green" />
                      <span className="text-[11px] font-semibold text-slate-600">
                        {selectedVideo.isDeepAnalysis ? "🚀 Đã phân tích SÂU toàn bộ video" : "✨ Đã phân tích bởi AI (Rút gọn)"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReanalyze(false)}
                        className="text-[10px] bg-white hover:bg-slate-50 font-bold border border-slate-200 text-slate-600 px-3 py-1.5 rounded transition"
                      >
                        Phân tích lại
                      </button>
                      {!selectedVideo.isDeepAnalysis && (
                        <button
                          onClick={() => handleReanalyze(true)}
                          className="text-[10px] bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold border border-sky-200 px-3 py-1.5 rounded transition flex items-center gap-1"
                        >
                          <Search className="h-3 w-3" />
                          Phân tích SÂU (Tốn token)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 1. Format viral */}
                  <section className="rounded border border-kolia-line bg-white p-4 shadow-2xs">
                    <h3 className="text-xs font-bold text-kolia-ink border-b border-kolia-line pb-2 mb-3">
                      1. Format viral
                    </h3>
                    <div className="divide-y divide-slate-100 text-xs space-y-2.5">
                      <div className="flex py-1">
                        <span className="w-32 shrink-0 font-semibold text-slate-500">📋 Mẫu tiêu đề</span>
                        <span className="text-kolia-ink font-medium">{selectedVideo.formatViral.titleTemplate}</span>
                      </div>
                      <div className="flex py-1">
                        <span className="w-32 shrink-0 font-semibold text-slate-500">🎯 Hook pattern</span>
                        <span className="text-kolia-ink font-medium">{selectedVideo.formatViral.hookPattern}</span>
                      </div>
                      <div className="flex py-1">
                        <span className="w-32 shrink-0 font-semibold text-slate-500">💡 Core promise</span>
                        <span className="text-kolia-ink font-medium">{selectedVideo.formatViral.corePromise}</span>
                      </div>
                      <div className="flex py-1">
                        <span className="w-32 shrink-0 font-semibold text-slate-500">🔍 Góc nội dung</span>
                        <span className="text-kolia-ink font-medium">{selectedVideo.formatViral.contentAngle}</span>
                      </div>
                      <div className="flex py-1">
                        <span className="w-32 shrink-0 font-semibold text-slate-500">🎙️ Phong cách</span>
                        <span className="text-kolia-ink font-medium">{selectedVideo.formatViral.style}</span>
                      </div>
                    </div>
                  </section>

                  {/* 2. Timeline & cấu trúc */}
                  <section className="rounded border border-kolia-line bg-white p-4 shadow-2xs">
                    <h3 className="text-xs font-bold text-kolia-ink border-b border-kolia-line pb-2 mb-4">
                      2. Timeline & cấu trúc
                    </h3>

                    {/* Timeline visualization */}
                    <div className="flex w-full gap-1 items-end mb-6 overflow-x-auto pb-2 custom-scrollbar snap-x">
                      {selectedVideo.segments?.map((seg, i) => (
                        <div key={i} className="flex flex-col flex-1 min-w-[90px] gap-1.5 group snap-start">
                          {/* Time label above */}
                          <div className="text-center">
                            <span className="text-[10px] font-bold text-slate-500 group-hover:text-kolia-ink transition-colors whitespace-nowrap">
                              {seg.time}
                            </span>
                          </div>
                          {/* Colored block */}
                          <div
                            className={`min-h-[36px] py-1 flex items-center justify-center rounded-sm text-[9px] sm:text-[10px] font-bold px-1.5 transition hover:opacity-90 text-center leading-tight ${seg.color}`}
                            title={seg.text}
                          >
                            <span className="whitespace-normal break-words">{seg.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Bullets */}
                    <ul className="space-y-2.5 text-xs leading-relaxed text-slate-700">
                      {selectedVideo.bullets?.map((bullet, index) => {
                        // Tách time (VD: "0-3s") và nội dung phía sau dấu ":"
                        const colonIndex = bullet.indexOf(":");
                        if (colonIndex > -1) {
                          const time = bullet.slice(0, colonIndex);
                          const desc = bullet.slice(colonIndex + 1).trim();
                          return (
                            <li key={index} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-kolia-ink" />
                              <span>
                                <strong className="text-kolia-ink">{time}:</strong> {desc}
                              </span>
                            </li>
                          );
                        }
                        // Fallback
                        return (
                          <li key={index} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-kolia-ink" />
                            <span>{bullet}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>

                  {/* 3. Edit & hiệu ứng */}
                  <section className="rounded border border-kolia-line bg-white p-4 shadow-2xs">
                    <h3 className="text-xs font-bold text-kolia-ink border-b border-kolia-line pb-2 mb-3">
                      3. Edit & hiệu ứng
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedVideo.effects?.map((eff) => (
                        <span
                          key={eff}
                          className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-800 border border-emerald-100"
                        >
                          {eff}
                        </span>
                      ))}
                    </div>
                  </section>

                  {/* 4. Content brief để tái sử dụng */}
                  <section className="rounded border border-kolia-line bg-white p-4 shadow-2xs">
                    <h3 className="text-xs font-bold text-kolia-ink border-b border-kolia-line pb-2 mb-3">
                      4. Content brief để tái sử dụng
                    </h3>
                    <div className="divide-y divide-slate-100 text-xs space-y-2">
                      <div className="flex py-0.5">
                        <span className="w-28 shrink-0 font-semibold text-slate-500">Chủ đề</span>
                        <span className="text-kolia-ink font-semibold">{selectedVideo.brief?.topic}</span>
                      </div>
                      <div className="flex py-0.5">
                        <span className="w-28 shrink-0 font-semibold text-slate-500">Góc triển khai</span>
                        <span className="text-slate-700 leading-relaxed">{selectedVideo.brief?.angle}</span>
                      </div>
                      <div className="flex py-0.5">
                        <span className="w-28 shrink-0 font-semibold text-slate-500">Key points</span>
                        <span className="text-slate-700 font-medium leading-relaxed">{selectedVideo.brief?.keyPoints}</span>
                      </div>
                      <div className="flex py-0.5">
                        <span className="w-28 shrink-0 font-semibold text-slate-500">CTA đề xuất</span>
                        <span className="text-kolia-green font-bold">{selectedVideo.brief?.cta}</span>
                      </div>
                    </div>
                  </section>

                  {variant !== "domestic" && (
                    <section className="col-span-2 rounded border border-kolia-line bg-white p-4 shadow-2xs">
                      <h3 className="text-xs font-bold text-kolia-ink border-b border-kolia-line pb-2 mb-3">
                        5. Đối chiếu tại Việt Nam
                      </h3>

                      <div className="grid gap-4 xl:grid-cols-[1fr_2fr] items-start">
                        {/* Verdict Card */}
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 flex flex-col justify-center min-h-[120px]">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Kết luận nhanh</span>
                          <div className="mt-2 flex items-start gap-2">
                            <div className="rounded-full bg-emerald-100 p-0.5 text-kolia-green shrink-0 mt-0.5">
                              <Check className="h-3.5 w-3.5 stroke-[3]" />
                            </div>
                            <div>
                              <h4 className="font-bold text-kolia-ink text-xs">
                                {selectedVideo.vietnamComparison?.quickVerdict}
                              </h4>
                              <p className="mt-0.5 text-[10px] text-slate-500 leading-relaxed">
                                {selectedVideo.vietnamComparison?.quickVerdictDesc}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Vietnam Channels Table */}
                        <div className="overflow-x-auto rounded border border-slate-150">
                          <table className="w-full text-left border-collapse text-[10px]">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-2 font-bold text-slate-600">#</th>
                                <th className="p-2 font-bold text-slate-600">Kênh</th>
                                <th className="p-2 font-bold text-slate-600">Chủ đề tương tự</th>
                                <th className="p-2 font-bold text-slate-600 text-right">Lượt xem</th>
                                <th className="p-2 font-bold text-slate-600 text-right">Độ giống</th>
                                <th className="p-2 font-bold text-slate-600">Hiệu quả</th>
                                <th className="p-2 font-bold text-slate-600">Ngày đăng</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {selectedVideo.vietnamComparison && selectedVideo.vietnamComparison.table.length > 0 ? (
                                selectedVideo.vietnamComparison.table.map((row: any, i: number) => (
                                  <tr key={i} className="hover:bg-slate-50/50">
                                    <td className="p-2 font-semibold text-slate-500">{i + 1}</td>
                                    <td className="p-2 font-bold text-kolia-ink">{row.channel}</td>
                                    <td className="p-2 text-slate-600 leading-relaxed">{row.topic}</td>
                                    <td className="p-2 text-right font-semibold text-slate-700">{row.views}</td>
                                    <td className="p-2 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <span className="h-1.5 w-12 rounded-full overflow-hidden bg-slate-100 flex">
                                          <span
                                            className={`h-full rounded-full ${
                                              row.relevanceScore >= 70
                                                ? "bg-emerald-500"
                                                : row.relevanceScore >= 50
                                                ? "bg-blue-400"
                                                : "bg-amber-400"
                                            }`}
                                            style={{ width: `${row.relevanceScore}%` }}
                                          />
                                        </span>
                                        <span className="font-semibold text-[9px] text-slate-600">{row.relevanceScore}%</span>
                                      </div>
                                    </td>
                                    <td className="p-2">
                                      <div className="flex items-center gap-1">
                                        <span className="h-1 w-10 rounded-full overflow-hidden bg-slate-100 flex">
                                          <span
                                            className={`h-full rounded-full ${
                                              row.efficiency === "Cao"
                                                ? "bg-emerald-500 w-full"
                                                : row.efficiency === "Trung bình"
                                                ? "bg-amber-400 w-2/3"
                                                : "bg-red-400 w-1/3"
                                            }`}
                                          />
                                        </span>
                                        <span className="font-semibold text-[9px] text-slate-600">{row.efficiency}</span>
                                      </div>
                                    </td>
                                    <td className="p-2 text-slate-400 whitespace-nowrap">{row.date}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={7} className="p-3 text-center text-slate-400 text-xs">
                                    Chưa tìm thấy video đối chiếu tương tự ở Việt Nam
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Footer link */}
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => {
                            const fullData = getVietnamComparison(
                              selectedVideo.mainTopic,
                              selectedVideo.category,
                              domesticPosts,
                              100
                            );
                            setVietnamVideosFullData(fullData);
                            setSelectedVietnamVideoIdx(0);
                            setShowMoreVietnamVideos(true);
                          }}
                          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-kolia-green hover:underline"
                        >
                          Xem thêm video tại Việt Nam
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </section>
                  )}
                </div>
              ) : activeTab === "transcript" ? (
                <TranscriptTabContent transcript={selectedVideo.transcript} />
              ) : activeTab === "highlights" && selectedVideo.highlights ? (
                <HighlightsTabContent summary={selectedVideo.summary} highlights={selectedVideo.highlights} />
              ) : activeTab === "tags" && selectedVideo.tags ? (
                <div className="flex flex-wrap gap-2">
                  {selectedVideo.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 border border-slate-200"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : activeTab === "channel" ? (
                selectedVideo.channelProfile ? (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-3 rounded-lg border border-slate-150 bg-white p-4 shadow-2xs">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center font-bold text-slate-600 text-lg uppercase shadow-inner shrink-0">
                        {selectedVideo.channel.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-kolia-ink">{selectedVideo.channel}</h4>
                        <span className="text-[10px] text-slate-400">{variant === "domestic" ? "Kênh Việt Nam" : "Kênh nước ngoài"}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                        selectedVideo.channelProfile.worthFollowing === "Có"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : selectedVideo.channelProfile.worthFollowing === "Không"
                          ? "bg-red-50 text-red-600 border border-red-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {selectedVideo.channelProfile.worthFollowing === "Có" ? "✅ Đáng theo dõi" : selectedVideo.channelProfile.worthFollowing === "Không" ? "❌ Không cần theo" : "⚡ Tuỳ mục đích"}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="rounded-lg border border-slate-150 bg-white p-4 shadow-2xs space-y-3 text-xs">
                      <div className="flex gap-3 py-2 border-b border-slate-100">
                        <span className="w-36 shrink-0 font-semibold text-slate-500">🎬 Phong cách ND</span>
                        <span className="text-slate-700 leading-relaxed">{selectedVideo.channelProfile.contentStyle}</span>
                      </div>
                      <div className="flex gap-3 py-2 border-b border-slate-100">
                        <span className="w-36 shrink-0 font-semibold text-slate-500">👥 Đối tượng</span>
                        <span className="text-slate-700 leading-relaxed">{selectedVideo.channelProfile.targetAudience}</span>
                      </div>
                      <div className="flex gap-3 py-2 border-b border-slate-100">
                        <span className="w-36 shrink-0 font-semibold text-slate-500">💪 Điểm mạnh</span>
                        <span className="text-slate-700 leading-relaxed">{selectedVideo.channelProfile.strengths}</span>
                      </div>
                      <div className="flex gap-3 py-2">
                        <span className="w-36 shrink-0 font-semibold text-slate-500">💡 Nhận xét</span>
                        <span className="text-slate-700 leading-relaxed">{selectedVideo.channelProfile.reason}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs">Đang tải thông tin kênh...</div>
                )
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">Đang tải thông tin phân tích...</div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-xs bg-slate-50/10">
            {variant === "domestic" ? "Chưa có video trong nước nào được import trong hệ thống" : "Chưa có video đối thủ nước ngoài nào được import trong hệ thống"}
          </div>
        )}
      </div>

      {/* ── Modal: Xem thêm video tại Việt Nam ─────────────────────────── */}
      {showMoreVietnamVideos && vietnamVideosFullData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => {
            setShowMoreVietnamVideos(false);
            setVietnamVideosFullData(null);
          }}
        >
          <div
            className="bg-white sm:rounded-2xl shadow-2xl w-full h-full sm:h-[82vh] sm:max-w-6xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-slate-800 truncate">
                  Video tại Việt Nam · {selectedVideo?.mainTopic}
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                  {vietnamVideosFullData.totalMatches} video liên quan · {vietnamVideosFullData.table.length} hiển thị
                </p>
              </div>
              <button
                onClick={() => {
                  setShowMoreVietnamVideos(false);
                  setVietnamVideosFullData(null);
                }}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kolia-green/40"
                aria-label="Đóng"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Body: Player (left) + Playlist (right) */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* ── Left: Video Player ─────────────────────────────────── */}
              <div className="lg:w-3/4 flex flex-col bg-slate-950 min-h-[45%]">
                {vietnamVideosFullData.table.length > 0 ? (
                  <>
                    <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
                      <div className="w-full max-w-4xl">
                        <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-xl ring-1 ring-white/10">
                          {(() => {
                            const currentRow = vietnamVideosFullData.table[selectedVietnamVideoIdx];
                            const youtubeId = currentRow?.postUrl ? extractYoutubeId(currentRow.postUrl) : null;
                            return youtubeId ? (
                              <iframe
                                width="100%"
                                height="100%"
                                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                                title={currentRow.topic}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full rounded-xl"
                              />
                            ) : currentRow?.postUrl ? (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="text-center text-slate-400">
                                  <Play className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                  <p className="text-sm">Không thể nhúng video</p>
                                  <a
                                    href={currentRow.postUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 mt-2 text-xs text-slate-300 hover:text-white transition-colors"
                                  >
                                    Xem trên nền tảng gốc
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="text-center text-slate-400">
                                  <Play className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                  <p className="text-sm">Chọn một video từ danh sách</p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    {/* Video info bar */}
                    {vietnamVideosFullData.table[selectedVietnamVideoIdx] && (
                      <div className="p-4 border-t border-white/10 bg-slate-900">
                        <h4 className="text-sm font-semibold text-white mb-2 leading-snug">
                          {vietnamVideosFullData.table[selectedVietnamVideoIdx].topic}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 tabular-nums">
                          <span>{vietnamVideosFullData.table[selectedVietnamVideoIdx].channel}</span>
                          <span className="opacity-40">•</span>
                          <span>{vietnamVideosFullData.table[selectedVietnamVideoIdx].views} lượt xem</span>
                          <span className="opacity-40">•</span>
                          <span
                            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                              vietnamVideosFullData.table[selectedVietnamVideoIdx].efficiency === "Cao"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : vietnamVideosFullData.table[selectedVietnamVideoIdx].efficiency === "Trung bình"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-red-500/20 text-red-300"
                            }`}
                          >
                            {vietnamVideosFullData.table[selectedVietnamVideoIdx].efficiency}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-6">
                    <div className="text-center text-slate-400">
                      <Eye className="h-16 w-16 mx-auto mb-4 opacity-30" />
                      <p className="text-sm">Chưa tìm thấy video đối chiếu tương tự ở Việt Nam</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Right: Playlist ────────────────────────────────────── */}
              <div className="lg:w-1/4 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col min-h-0">
                {/* Verdict summary */}
                <div className="shrink-0 border-b border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start gap-2">
                    <div className="rounded-full bg-emerald-100 p-0.5 text-kolia-green shrink-0 mt-0.5">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-kolia-ink text-[11px]">{vietnamVideosFullData.quickVerdict}</h4>
                      <p className="mt-0.5 text-[9px] text-slate-500 leading-relaxed">{vietnamVideosFullData.quickVerdictDesc}</p>
                    </div>
                  </div>
                </div>

                {/* Scrollable playlist */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {vietnamVideosFullData.table.map((row: any, i: number) => {
                    const isSelected = selectedVietnamVideoIdx === i;
                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedVietnamVideoIdx(i)}
                        className={`group flex gap-2.5 rounded-xl p-2 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-kolia-ink text-white"
                            : "hover:bg-slate-100"
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="relative h-[52px] w-[80px] shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {row.thumbnailUrl ? (
                            <img
                              src={row.thumbnailUrl}
                              alt={row.topic}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Eye className="h-4 w-4 text-slate-300" />
                            </div>
                          )}
                          {/* Index badge */}
                          <span className={`absolute bottom-0.5 left-0.5 flex h-[16px] w-[16px] items-center justify-center rounded-full text-[8px] font-bold leading-none ${
                            isSelected ? "bg-white/25 text-white" : "bg-black/75 text-white"
                          }`}>
                            {i + 1}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <p className={`text-[10.5px] font-medium leading-tight line-clamp-2 ${
                            isSelected ? "text-white" : "text-slate-700"
                          }`}>
                            {row.topic}
                          </p>
                          <p className={`text-[9px] truncate mt-0.5 ${
                            isSelected ? "text-slate-300" : "text-slate-400"
                          }`}>
                            {row.channel}
                          </p>
                          {/* Stats */}
                          <div className={`flex items-center gap-1.5 mt-0.5 ${
                            isSelected ? "text-slate-300" : "text-slate-500"
                          }`}>
                            <span className="text-[8px] font-semibold">{row.views}</span>
                            <span className="text-[8px] opacity-40">·</span>
                            <span className="text-[8px]">{row.relevanceScore}%</span>
                            <span className="text-[8px] opacity-40">·</span>
                            <span className="text-[8px]">{row.efficiency}</span>
                          </div>
                        </div>

                        {/* External link */}
                        {row.postUrl && (
                          <a
                            href={row.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`shrink-0 opacity-0 group-hover:opacity-100 transition self-start mt-1 ${
                              isSelected ? "text-white/60 hover:text-white" : "text-slate-400 hover:text-slate-600"
                            }`}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>

                {vietnamVideosFullData.hasMore && (
                  <div className="shrink-0 border-t border-slate-100 p-2 text-center">
                    <p className="text-[8px] text-slate-400">
                      +{vietnamVideosFullData.totalMatches - vietnamVideosFullData.table.length} video khác (độ tương đồng thấp hơn)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
