/**
 * Content Gap Snapshot — AI pipeline + DB cache
 *
 * Luồng:
 *   1. Sau mỗi sync → refreshContentGapSnapshot() → AI aggregate → lưu DB
 *   2. User vào trang → getLatestSnapshot() → đọc từ DB, không gọi AI
 *   3. User bấm "Phân tích sâu hơn" → deepAnalyzeTopic() → AI per-topic → lưu vào snapshot
 */

import { prisma } from "@/lib/prisma";
import { callAI, isOpenAIConfigured } from "@/lib/openai";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TopicPriority = "Cao" | "Trung bình" | "Thấp";
export type CompetitionLevel = "Cao" | "Trung bình" | "Thấp";

export type TopicVideo = {
  id: string;
  title: string;
  channelName: string;
  views: number;
  engagementRate: number;
  thumbnailUrl?: string;
  youtubeId?: string;
  publishedAt: string;
};

export type TopicRow = {
  slug: string;            // "xac-dinh-day-thi-truong" (dùng làm key)
  name: string;            // "Xác định đáy thị trường"
  videoCount: number;
  channelCount: number;
  medianViews: number;     // median views thực từ posts DB
  totalViews: number;      // tổng lượt xem (bubble size)
  outlierRate: number;     // tỷ lệ video outlier (Y-axis option)
  growthRate30d: number;   // tốc độ tăng trưởng 30 ngày (bubble color, %)
  avgEngagement: number;   // tỷ lệ tương tác trung bình
  competitionScore: number; // # video / # kênh (X-axis)
  sampleVideos: TopicVideo[]; // all videos for drill-down
  priority: TopicPriority;
  detail?: TopicDetail;    // AI generated per-topic summary, null = chưa generate
  deepDetail?: TopicDeepDetail;
  priorityConfidence?: "low" | "medium" | "high"; // từ nút "Phân tích sâu hơn với AI"
};

export type TopicDetail = {
  badge: string;              // "Cơ hội cao" | "Cạnh tranh cao" | "Tiềm năng"
  tagline: string;            // 1-sentence description
  competitionLevel: CompetitionLevel;
  channels: string[];         // tên kênh thực từ DB competitor
  hooks: string[];            // hookType examples từ DB posts
  contentAngles: string[];    // AI suggest content angles
  internationalNote?: string; // ghi chú nếu topic cũng phổ biến ở nước ngoài
  generatedAt: string;        // ISO timestamp
};

export type TopicDeepDetail = {
  summary: string;
  opportunity: string;
  scriptSuggestion: string;
  targetAudience: string;
  risks: string[];
  tactics: string[];
  generatedAt: string;
};

export type SnapshotStats = {
  notableTopics: number;
  notableTopicsTrend: number;    // % so với tháng trước (0 nếu chưa có lịch sử)
  repeatedTopics: number;
  repeatedTopicsTrend: number;
  gaps: number;
  gapsTrend: number;
  dataNote: string;              // "Dữ liệu từ X kênh tài chính..."
  updatedAt: string;
};

export type DomesticGapSnapshot = {
  stats: SnapshotStats;
  commonTopics: TopicRow[];
  repeatedTopics: TopicRow[];
  underusedHighEngagement: TopicRow[];
  gaps: TopicRow[];
};

// ─── Priority scoring config ───────────────────────────────────────────────────

export const PRIORITY_CONFIG = {
  /** Engagement phải ≥ 1.5x baseline mới coi là "vượt trội". */
  HIGH_ENGAGEMENT_MULTIPLIER: 1.5,
  /** Số kênh tối đa để coi là "ít cạnh tranh" — điều kiện cần cho priority "Cao". */
  MAX_CHANNELS_FOR_HIGH: 4,
  /**
   * Cỡ mẫu tối thiểu (video) để tin vào engagement rate riêng của 1 topic
   * khi xét "Cao". Đây là lá chắn chống outlier n nhỏ — VD topic chỉ 2 video,
   * 1 video ăn may cũng đủ đội engagement trung bình lên 1.5x một cách ngẫu nhiên.
   */
  MIN_SAMPLE_FOR_HIGH: 3,
  /**
   * Từ videoCount này trở lên, topic được coi là "được đầu tư nội dung nhiều"
   * — đủ để xếp tối thiểu "Trung bình" dù engagement rate hơi dưới baseline.
   * Tránh case: topic có volume cao nhất nhưng bị dán nhãn "Thấp" chỉ vì
   * rate hơi thấp hơn trung bình chung.
   */
  HIGH_VOLUME_THRESHOLD: 5,
} as const;

export type TopicPriorityResult = {
  priority: TopicPriority;
  confidence: "low" | "medium" | "high";
};

/**
 * Hàm thuần, dễ unit test. Quyết định dựa trên giá trị THẬT (avgEng thô) —
 * việc chống outlier ở n nhỏ xử lý bằng gate `MIN_SAMPLE_FOR_HIGH`, không
 * làm méo giá trị engagement bằng cách trộn với baseline (tránh phạt nhầm
 * các topic n vừa phải nhưng engagement thật sự cao).
 */
export function computeTopicPriority(
  avgEng: number,
  videoCount: number,
  channelCount: number,
  overallAvg: number,
  config: typeof PRIORITY_CONFIG = PRIORITY_CONFIG
): TopicPriorityResult {
  const confidence: "low" | "medium" | "high" =
    videoCount < config.MIN_SAMPLE_FOR_HIGH
      ? "low"
      : videoCount < config.HIGH_VOLUME_THRESHOLD
      ? "medium"
      : "high";

  const isHighEngagement = avgEng >= overallAvg * config.HIGH_ENGAGEMENT_MULTIPLIER;
  const isLowCompetition = channelCount <= config.MAX_CHANNELS_FOR_HIGH;
  const hasEnoughSample = videoCount >= config.MIN_SAMPLE_FOR_HIGH;
  const isAboveBaseline = avgEng >= overallAvg;
  const isHighVolume = videoCount >= config.HIGH_VOLUME_THRESHOLD;

  let priority: TopicPriority;
  if (isHighEngagement && isLowCompetition && hasEnoughSample) {
    priority = "Cao";
  } else if (isAboveBaseline || isHighVolume) {
    priority = "Trung bình";
  } else {
    priority = "Thấp";
  }

  return { priority, confidence };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

// ─── Build topic rows from real DB data ───────────────────────────────────────

type PillarPostRaw = {
  id: string;
  title: string;
  views: number;
  engagementRate: number;
  thumbnailUrl: string | null;
  postUrl: string;
  publishedAt: Date;
  competitorName: string;
};

type PillarPostData = {
  pillar: string;
  views: number[];
  competitorIds: Set<string>;
  channelNames: Set<string>;
  hookTypes: string[];
  engagements: number[];
  posts: PillarPostRaw[];
  // 30-day vs 60-day split for growth
  views30d: number[];
  views60d: number[];
};

async function buildTopicRows(
  platform = "youtube",
  source = "trong_nuoc",
  dayWindow = 90
): Promise<{
  rows: Map<string, PillarPostData>;
  overallAvg: number;
  totalCompetitors: number;
  competitorCount: number;
}> {
  const since = new Date();
  since.setDate(since.getDate() - dayWindow);
  const since30d = new Date();
  since30d.setDate(since30d.getDate() - 30);

  const posts = await prisma.post.findMany({
    where: {
      platform,
      publishedAt: { gte: since },
      competitor: { source },
      NOT: { relevanceStatus: "irrelevant" },
    },
    include: { competitor: { select: { id: true, name: true } } },
    orderBy: { publishedAt: "desc" },
  });

  // Distinct competitor count
  const competitorIds = new Set(posts.map((p) => p.competitorId));

  // Group by contentPillar
  const rows = new Map<string, PillarPostData>();
  for (const post of posts) {
    const pillar = post.contentPillar || "Khác";
    if (!rows.has(pillar)) {
      rows.set(pillar, {
        pillar,
        views: [],
        competitorIds: new Set(),
        channelNames: new Set(),
        hookTypes: [],
        engagements: [],
        posts: [],
        views30d: [],
        views60d: [],
      });
    }
    const row = rows.get(pillar)!;
    row.views.push(post.views);
    row.competitorIds.add(post.competitorId);
    row.channelNames.add(post.competitor.name);
    if (post.hookType) row.hookTypes.push(post.hookType);
    row.engagements.push(post.engagementRate);
    row.posts.push({
      id: post.id,
      title: post.title,
      views: post.views,
      engagementRate: post.engagementRate,
      thumbnailUrl: post.thumbnailUrl ?? null,
      postUrl: post.postUrl,
      publishedAt: post.publishedAt,
      competitorName: post.competitor.name,
    });
    if (post.publishedAt >= since30d) {
      row.views30d.push(post.views);
    } else {
      row.views60d.push(post.views);
    }
  }

  const overallAvg = posts.length
    ? posts.reduce((s, p) => s + p.engagementRate, 0) / posts.length
    : 0;

  return { rows, overallAvg, totalCompetitors: posts.length, competitorCount: competitorIds.size };
}

// ─── AI: classify topics into 4 categories ────────────────────────────────────

type AICategorizationResult = {
  commonTopics: string[];       // pillar names
  repeatedTopics: string[];
  underusedHighEngagement: string[];
  gaps: string[];
};

async function aiCategorizePillars(
  pillarStats: Array<{
    name: string;
    videoCount: number;
    channelCount: number;
    medianViews: number;
    avgEngagement: number;
  }>,
  overallAvg: number
): Promise<AICategorizationResult> {
  const aiAvailable = await isOpenAIConfigured();

  if (!aiAvailable || !pillarStats.length) {
    // Fallback: rule-based categorization
    const sorted = [...pillarStats].sort((a, b) => b.videoCount - a.videoCount);
    const medianCount = sorted[Math.floor(sorted.length / 2)]?.videoCount ?? 0;
    return {
      commonTopics: sorted.slice(0, 5).map((p) => p.name),
      repeatedTopics: sorted
        .filter((p) => p.videoCount > medianCount && p.avgEngagement < overallAvg)
        .slice(0, 3)
        .map((p) => p.name),
      underusedHighEngagement: sorted
        .filter((p) => p.videoCount <= Math.max(1, medianCount) && p.avgEngagement >= overallAvg)
        .slice(0, 3)
        .map((p) => p.name),
      gaps: sorted
        .filter((p) => p.channelCount <= 2 && p.avgEngagement >= overallAvg)
        .slice(0, 4)
        .map((p) => p.name),
    };
  }

  try {
    const statsJson = JSON.stringify({ pillars: pillarStats, overallAvgEngagement: overallAvg });
    const response = await callAI([
      {
        role: "system",
        content:
          "Chuyên gia phân tích nội dung tài chính Việt Nam. Trả lời ngắn gọn, CHỈ JSON, không markdown.",
      },
      {
        role: "user",
        content: `Dữ liệu pillar nội dung từ đối thủ trong nước:\n${statsJson}\n\nPhân loại các pillar vào 4 nhóm. Trả về JSON:\n{"commonTopics":["3-6 pillar phổ biến nhất, nhiều kênh làm"],"repeatedTopics":["2-4 pillar bị lặp lại, engagement thấp hơn trung bình"],"underusedHighEngagement":["2-4 pillar ít kênh làm nhưng engagement cao"],"gaps":["3-5 pillar khoảng trống Kolia có thể khai thác"]}`,
      },
    ], { maxTokens: 2000 });

    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        commonTopics: parsed.commonTopics ?? [],
        repeatedTopics: parsed.repeatedTopics ?? [],
        underusedHighEngagement: parsed.underusedHighEngagement ?? [],
        gaps: parsed.gaps ?? [],
      };
    }
  } catch (err) {
    console.warn("[content-gap-snapshot] AI categorize failed, using fallback:", err);
  }

  // Fallback if AI returns bad JSON
  const sorted = [...pillarStats].sort((a, b) => b.videoCount - a.videoCount);
  return {
    commonTopics: sorted.slice(0, 5).map((p) => p.name),
    repeatedTopics: sorted.slice(5, 8).map((p) => p.name),
    underusedHighEngagement: sorted
      .filter((p) => p.avgEngagement >= overallAvg)
      .slice(0, 3)
      .map((p) => p.name),
    gaps: sorted.slice(-4).map((p) => p.name),
  };
}

// ─── AI: generate per-topic detail ───────────────────────────────────────────

async function aiGenerateTopicDetail(
  topicName: string,
  channels: string[],
  hooks: string[],
  videoCount: number,
  medianViews: number,
  channelCount: number
): Promise<TopicDetail> {
  const generatedAt = new Date().toISOString();

  const aiAvailable = await isOpenAIConfigured();
  if (!aiAvailable) {
    return {
      badge: channelCount <= 3 ? "Cơ hội cao" : channelCount <= 6 ? "Tiềm năng" : "Cạnh tranh cao",
      tagline: `Chủ đề "${topicName}" có ${videoCount} video từ ${channelCount} kênh.`,
      competitionLevel: channelCount <= 3 ? "Thấp" : channelCount <= 6 ? "Trung bình" : "Cao",
      channels: channels.slice(0, 6),
      hooks: [...new Set(hooks)].slice(0, 5),
      contentAngles: ["Phân tích chuyên sâu từ góc độ dữ liệu", "Case study thực tế từ thị trường Việt Nam"],
      generatedAt,
    };
  }

  try {
    const prompt = `Chủ đề nội dung: "${topicName}"
Số video: ${videoCount} | Số kênh: ${channelCount} | Median views: ${formatViews(medianViews)}
Các kênh đang làm: ${channels.slice(0, 8).join(", ")}
Hook types phổ biến: ${[...new Set(hooks)].slice(0, 5).join(", ")}

Trả về JSON TIẾNG VIỆT (chỉ JSON):
{
  "badge": "Cơ hội cao|Tiềm năng|Cạnh tranh cao",
  "tagline": "1 câu mô tả cơ hội, tối đa 12 từ",
  "competitionLevel": "Cao|Trung bình|Thấp",
  "contentAngles": ["3-4 góc nội dung Kolia có thể triển khai khác biệt"],
  "internationalNote": "nếu chủ đề này cũng phổ biến ở YouTube quốc tế thì ghi chú ngắn, không thì null"
}`;

    const response = await callAI([
      { role: "system", content: "Chuyên gia nội dung tài chính Việt Nam. Chỉ JSON." },
      { role: "user", content: prompt },
    ], { maxTokens: 800 });

    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        badge: parsed.badge ?? "Tiềm năng",
        tagline: parsed.tagline ?? `Chủ đề "${topicName}" đang được nhiều kênh khai thác.`,
        competitionLevel: parsed.competitionLevel ?? "Trung bình",
        channels: channels.slice(0, 6),
        hooks: [...new Set(hooks)].slice(0, 5),
        contentAngles: parsed.contentAngles ?? [],
        internationalNote: parsed.internationalNote ?? undefined,
        generatedAt,
      };
    }
  } catch (err) {
    console.warn(`[content-gap-snapshot] AI topic detail failed for "${topicName}":`, err);
  }

  return {
    badge: channelCount <= 3 ? "Cơ hội cao" : "Tiềm năng",
    tagline: `Chủ đề có ${videoCount} video từ ${channelCount} kênh trong nước.`,
    competitionLevel: channelCount <= 3 ? "Thấp" : "Trung bình",
    channels: channels.slice(0, 6),
    hooks: [...new Set(hooks)].slice(0, 5),
    contentAngles: ["Phân tích dữ liệu chuyên sâu", "Góc nhìn giáo dục trung lập"],
    generatedAt,
  };
}

// ─── Main: refresh snapshot ───────────────────────────────────────────────────

/**
 * Orchestrate toàn bộ pipeline AI → DB.
 * Được gọi sau mỗi sync hoàn tất (fire-and-forget).
 */
export async function refreshContentGapSnapshot(
  platform = "youtube",
  source = "trong_nuoc",
  onLog?: (msg: string) => void
): Promise<void> {
  onLog?.("🔍 [ContentGap] Bắt đầu tổng hợp phân tích content gap...");

  try {
    const { rows, overallAvg, competitorCount } = await buildTopicRows(platform, source);

    if (rows.size === 0) {
      onLog?.("⚠️ [ContentGap] Chưa có dữ liệu đối thủ trong nước để phân tích.");
      return;
    }

    // Build pillar stats for AI
    const pillarStats = Array.from(rows.entries()).map(([name, data]) => ({
      name,
      videoCount: data.views.length,
      channelCount: data.competitorIds.size,
      medianViews: median(data.views),
      avgEngagement: data.engagements.length
        ? data.engagements.reduce((s, e) => s + e, 0) / data.engagements.length
        : 0,
    }));

    onLog?.("🤖 [ContentGap] AI đang phân loại chủ đề...");
    const categorized = await aiCategorizePillars(pillarStats, overallAvg);

    // Generate per-topic detail for all topics
    const allTopicNames = [
      ...categorized.commonTopics,
      ...categorized.repeatedTopics,
      ...categorized.underusedHighEngagement,
      ...categorized.gaps,
    ];
    const uniqueTopicNames = [...new Set(allTopicNames)];

    onLog?.(`🤖 [ContentGap] Đang generate chi tiết cho ${uniqueTopicNames.length} chủ đề...`);

    const topicDetailMap = new Map<string, TopicDetail>();
    for (const name of uniqueTopicNames) {
      const data = rows.get(name);
      if (!data) continue;
      const detail = await aiGenerateTopicDetail(
        name,
        [...data.channelNames],
        data.hookTypes,
        data.views.length,
        median(data.views),
        data.competitorIds.size
      );
      topicDetailMap.set(name, detail);
      onLog?.(`  ✅ "${name}" — ${detail.badge}`);
    }

    // Compute outlier rate: videos whose views > 2x median of their own channel avg
    function computeOutlierRate(viewsArr: number[]): number {
      if (!viewsArr.length) return 0;
      const med = median(viewsArr);
      const threshold = med * 2;
      const outliers = viewsArr.filter((v) => v > threshold || v < med / 2);
      return outliers.length / viewsArr.length;
    }

    // Compute growth rate: compare median views of last 30d vs prior 30d (31-60d)
    function computeGrowthRate(views30d: number[], views60d: number[]): number {
      const med30 = median(views30d);
      const med60 = median(views60d);
      if (!med60) return views30d.length > 0 ? 100 : 0;
      return Math.round(((med30 - med60) / med60) * 100);
    }

    // Build TopicRow array from category name
    function buildRows(names: string[]): TopicRow[] {
      const result: TopicRow[] = [];
      for (const name of names) {
        const data = rows.get(name);
        if (!data) continue;
        const detail = topicDetailMap.get(name);
        const channelCount = data.competitorIds.size;
        const videoCount = data.views.length;
        const avgEng = data.engagements.length
          ? data.engagements.reduce((s, e) => s + e, 0) / data.engagements.length
          : 0;
        const totalViews = data.views.reduce((s, v) => s + v, 0);
        const outlierRate = computeOutlierRate(data.views);
        const growthRate30d = computeGrowthRate(data.views30d, data.views60d);
        const competitionScore = channelCount > 0 ? Math.round((videoCount / channelCount) * 10) / 10 : videoCount;
        // Top videos sorted by views desc (include all for drill-down)
        const sortedPosts = [...data.posts].sort((a, b) => b.views - a.views);
        const sampleVideos: TopicVideo[] = sortedPosts.map((p) => {
          // Extract YouTube video ID from postUrl (e.g. https://youtube.com/watch?v=XXXXX)
          let youtubeId: string | undefined;
          try {
            const url = new URL(p.postUrl);
            youtubeId = url.searchParams.get("v") ?? url.pathname.split("/").pop() ?? undefined;
            if (youtubeId && youtubeId.length < 4) youtubeId = undefined;
          } catch {
            youtubeId = undefined;
          }
          return {
            id: p.id,
            title: p.title,
            channelName: p.competitorName,
            views: p.views,
            engagementRate: p.engagementRate,
            thumbnailUrl: p.thumbnailUrl ?? undefined,
            youtubeId,
            publishedAt: p.publishedAt.toISOString(),
          };
        });
        const { priority, confidence } = computeTopicPriority(
          avgEng,
          videoCount,
          channelCount,
          overallAvg
        );
        result.push({
          slug: slugify(name),
          name,
          videoCount,
          channelCount,
          medianViews: median(data.views),
          totalViews,
          outlierRate,
          growthRate30d,
          avgEngagement: avgEng,
          competitionScore,
          sampleVideos,
          priority,
          priorityConfidence: confidence,
          detail,
        });
      }
      // Sort: Cao → Trung bình → Thấp, cùng priority sort medianViews giảm dần
      const priorityOrder: Record<TopicPriority, number> = { "Cao": 0, "Trung bình": 1, "Thấp": 2 };
      result.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || b.medianViews - a.medianViews);
      return result;
    }

    const snapshot: DomesticGapSnapshot = {
      stats: {
        notableTopics: categorized.commonTopics.length,
        notableTopicsTrend: 0,    // 0% — chưa có lịch sử tháng trước
        repeatedTopics: categorized.repeatedTopics.length,
        repeatedTopicsTrend: 0,
        gaps: categorized.gaps.length,
        gapsTrend: 0,
        dataNote: `Dữ liệu từ ${competitorCount}+ kênh tài chính & đầu tư Việt Nam. Cập nhật mỗi 24 giờ.`,
        updatedAt: new Date().toISOString(),
      },
      commonTopics: buildRows(categorized.commonTopics),
      repeatedTopics: buildRows(categorized.repeatedTopics),
      underusedHighEngagement: buildRows(categorized.underusedHighEngagement),
      gaps: buildRows(categorized.gaps),
    };

    await prisma.contentGapSnapshot.create({
      data: {
        platform,
        source,
        data: JSON.stringify(snapshot),
        generatedAt: new Date(),
      },
    });

    // Keep only last 5 snapshots (cleanup)
    const old = await prisma.contentGapSnapshot.findMany({
      where: { platform, source },
      orderBy: { generatedAt: "desc" },
      skip: 5,
      select: { id: true },
    });
    if (old.length > 0) {
      await prisma.contentGapSnapshot.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    }

    onLog?.("✅ [ContentGap] Snapshot đã được lưu vào DB.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[content-gap-snapshot] refreshContentGapSnapshot failed:", msg);
    onLog?.(`⚠️ [ContentGap] Snapshot thất bại: ${msg}`);
  }
}

// ─── Read snapshot from DB ─────────────────────────────────────────────────────

export async function getLatestSnapshot(
  platform = "youtube",
  source = "trong_nuoc"
): Promise<{ snapshot: DomesticGapSnapshot; generatedAt: Date; id: string } | null> {
  const row = await prisma.contentGapSnapshot.findFirst({
    where: { platform, source },
    orderBy: { generatedAt: "desc" },
  });

  if (!row) return null;

  try {
    const snapshot = JSON.parse(row.data) as DomesticGapSnapshot;

    // ── Live-filter: loại bỏ các video hiện đang irrelevant khỏi sampleVideos ──
    // Đảm bảo Bubble chart luôn chính xác dù snapshot được tạo trước khi video bị lọc.
    // Chỉ query ID nên rất nhanh (< 5ms), không tốn AI quota.
    const irrelevantPosts = await prisma.post.findMany({
      where: { platform, relevanceStatus: "irrelevant" },
      select: { id: true },
    });
    const irrelevantIds = new Set(irrelevantPosts.map((p) => p.id));

    if (irrelevantIds.size > 0) {
      const categories: (keyof Omit<DomesticGapSnapshot, "stats">)[] = [
        "commonTopics",
        "repeatedTopics",
        "underusedHighEngagement",
        "gaps",
      ];
      for (const cat of categories) {
        snapshot[cat] = (snapshot[cat] ?? [])
          .map((topic) => {
            const remaining = (topic.sampleVideos ?? []).filter(
              (v) => !irrelevantIds.has(v.id)
            );
            if (remaining.length === 0) return null;

            const views = remaining.map((v) => v.views);
            const totalViews = views.reduce((s, v) => s + v, 0);
            const avgEng = remaining.length
              ? remaining.reduce((s, v) => s + v.engagementRate, 0) / remaining.length
              : 0;
            const channelCount = new Set(remaining.map((v) => v.channelName)).size;
            const videoCount = remaining.length;
            const competitionScore =
              channelCount > 0
                ? Math.round((videoCount / channelCount) * 10) / 10
                : videoCount;

            // median helper inline
            const sorted = [...views].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            const med =
              sorted.length % 2 === 0
                ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
                : sorted[mid];

            return {
              ...topic,
              sampleVideos: remaining,
              videoCount,
              channelCount,
              totalViews,
              medianViews: med,
              avgEngagement: avgEng,
              competitionScore,
            };
          })
          .filter(Boolean) as typeof snapshot[typeof cat];
      }
    }

    return { snapshot, generatedAt: row.generatedAt, id: row.id };
  } catch {
    return null;
  }
}


// ─── Deep analyze per topic ────────────────────────────────────────────────────

/**
 * Phân tích sâu hơn 1 topic theo yêu cầu người dùng.
 * Lưu kết quả vào deepDetail trong snapshot mới nhất.
 */
export async function deepAnalyzeTopic(
  topicSlug: string,
  platform = "youtube",
  source = "trong_nuoc"
): Promise<TopicDeepDetail | null> {
  const result = await getLatestSnapshot(platform, source);
  if (!result) return null;

  const { snapshot, id } = result;

  // Find topic across all categories
  const allCategories: (keyof Omit<DomesticGapSnapshot, "stats">)[] = [
    "commonTopics",
    "repeatedTopics",
    "underusedHighEngagement",
    "gaps",
  ];

  let foundTopic: TopicRow | undefined;
  let foundCategory: string | undefined;

  for (const cat of allCategories) {
    const topic = snapshot[cat].find((t) => t.slug === topicSlug);
    if (topic) {
      foundTopic = topic;
      foundCategory = cat;
      break;
    }
  }

  if (!foundTopic) return null;

  // Return existing deepDetail if already generated
  if (foundTopic.deepDetail) {
    return foundTopic.deepDetail;
  }

  const generatedAt = new Date().toISOString();
  let deepDetail: TopicDeepDetail;

  const aiAvailable = await isOpenAIConfigured();
  if (!aiAvailable) {
    deepDetail = {
      summary: `Chủ đề "${foundTopic.name}" có ${foundTopic.videoCount} video từ ${foundTopic.channelCount} kênh với median ${formatViews(foundTopic.medianViews)} views.`,
      opportunity: "Cơ hội khai thác từ góc độ giáo dục và phân tích trung lập.",
      scriptSuggestion: `Mở đầu bằng một câu hỏi liên quan đến ${foundTopic.name}, sau đó trình bày 3-5 điểm phân tích chính, kết thúc bằng lời mời thảo luận.`,
      targetAudience: "Nhà đầu tư cá nhân mới đến trung cấp, quan tâm đến tài chính cá nhân.",
      risks: ["Chủ đề cạnh tranh — cần góc nhìn độc đáo", "Dễ trở thành nội dung lặp lại nếu không có dữ liệu mới"],
      tactics: ["Dùng dữ liệu thực tế từ thị trường Việt Nam", "Kết hợp case study minh họa", "CTA mời tham gia cộng đồng"],
      generatedAt,
    };
  } else {
    try {
      const prompt = `Phân tích sâu chủ đề nội dung: "${foundTopic.name}"
Nhóm: ${foundCategory} | Video: ${foundTopic.videoCount} | Kênh: ${foundTopic.channelCount}
Median views: ${formatViews(foundTopic.medianViews)} | Priority: ${foundTopic.priority}
Các kênh đang làm: ${foundTopic.detail?.channels?.join(", ") || "chưa rõ"}

Trả về JSON TIẾNG VIỆT (chỉ JSON, tối đa 400 từ):
{
  "summary": "Tóm tắt 2-3 câu về chủ đề và tiềm năng",
  "opportunity": "Cơ hội cụ thể Kolia có thể khai thác, 2-3 câu",
  "scriptSuggestion": "Gợi ý cấu trúc script 3-5 bước ngắn gọn",
  "targetAudience": "Đối tượng mục tiêu cụ thể",
  "risks": ["2-3 rủi ro hoặc thách thức"],
  "tactics": ["3-4 chiến thuật triển khai hiệu quả"]
}`;

      const response = await callAI([
        { role: "system", content: "Chuyên gia chiến lược nội dung tài chính Việt Nam. Chỉ JSON." },
        { role: "user", content: prompt },
      ], { maxTokens: 1200 });

      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        deepDetail = {
          summary: parsed.summary ?? "",
          opportunity: parsed.opportunity ?? "",
          scriptSuggestion: parsed.scriptSuggestion ?? "",
          targetAudience: parsed.targetAudience ?? "",
          risks: parsed.risks ?? [],
          tactics: parsed.tactics ?? [],
          generatedAt,
        };
      } else {
        throw new Error("Invalid AI response");
      }
    } catch (err) {
      console.warn(`[content-gap-snapshot] Deep analyze AI failed for "${foundTopic.name}":`, err);
      deepDetail = {
        summary: `Chủ đề "${foundTopic.name}" có ${foundTopic.videoCount} video từ ${foundTopic.channelCount} kênh.`,
        opportunity: "Cơ hội khai thác từ góc độ giáo dục trung lập.",
        scriptSuggestion: "Hook → Bối cảnh → Phân tích → Case study → CTA",
        targetAudience: "Nhà đầu tư cá nhân quan tâm tài chính.",
        risks: ["Cần góc nhìn khác biệt để nổi bật"],
        tactics: ["Dữ liệu thực", "Ví dụ cụ thể", "CTA rõ ràng"],
        generatedAt,
      };
    }
  }

  // Save deepDetail back into snapshot
  const updatedSnapshot = { ...snapshot };
  if (foundCategory) {
    const cat = foundCategory as keyof Omit<DomesticGapSnapshot, "stats">;
    updatedSnapshot[cat] = updatedSnapshot[cat].map((t) =>
      t.slug === topicSlug ? { ...t, deepDetail } : t
    );
  }

  await prisma.contentGapSnapshot.update({
    where: { id },
    data: { data: JSON.stringify(updatedSnapshot) },
  });

  return deepDetail;
}

/**
 * Fast in-place update of latest snapshot when posts are deleted/filtered out.
 * Recalculates metrics (views, engagement, video count) arithmetic-only without calling OpenAI AI.
 */
export async function updateContentGapSnapshotWithDeletedPostIds(
  deletedIds: string[],
  platform = "youtube",
  source = "trong_nuoc"
): Promise<void> {
  if (!deletedIds || deletedIds.length === 0) return;

  const result = await getLatestSnapshot(platform, source);
  if (!result) return;

  const deletedSet = new Set(deletedIds);
  const { snapshot, id } = result;

  const categories: (keyof Omit<DomesticGapSnapshot, "stats">)[] = [
    "commonTopics",
    "repeatedTopics",
    "underusedHighEngagement",
    "gaps",
  ];

  const updatedSnapshot: DomesticGapSnapshot = {
    ...snapshot,
    stats: {
      ...snapshot.stats,
      updatedAt: new Date().toISOString(),
    },
  };

  for (const cat of categories) {
    const topicRows = snapshot[cat] ?? [];
    const newTopicRows: TopicRow[] = [];

    for (const topic of topicRows) {
      const remainingVideos = (topic.sampleVideos ?? []).filter((v) => !deletedSet.has(v.id));
      if (remainingVideos.length === 0) continue;

      const channelNames = new Set(remainingVideos.map((v) => v.channelName));
      const channelCount = channelNames.size;
      const videoCount = remainingVideos.length;
      const views = remainingVideos.map((v) => v.views);
      const totalViews = views.reduce((s, v) => s + v, 0);
      const avgEng = remainingVideos.length
        ? remainingVideos.reduce((s, v) => s + v.engagementRate, 0) / remainingVideos.length
        : 0;

      const competitionScore = channelCount > 0 ? Math.round((videoCount / channelCount) * 10) / 10 : videoCount;

      newTopicRows.push({
        ...topic,
        videoCount,
        channelCount,
        medianViews: median(views),
        totalViews,
        avgEngagement: avgEng,
        competitionScore,
        sampleVideos: remainingVideos,
      });
    }

    updatedSnapshot[cat] = newTopicRows;
  }

  await prisma.contentGapSnapshot.update({
    where: { id },
    data: { data: JSON.stringify(updatedSnapshot) },
  });
}

