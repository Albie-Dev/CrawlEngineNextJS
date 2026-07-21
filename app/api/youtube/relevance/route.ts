import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearNLQueryContextCache } from "@/lib/nlQueryAnalytics";

// ── GET: Danh sách video YouTube kèm relevance info ──────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const channel = searchParams.get("channel") || "";
  const pillar = searchParams.get("pillar") || "";
  const format = searchParams.get("format") || "";
  const status = searchParams.get("status") || ""; // "pending" | "relevant" | "irrelevant" | "" (all)
  const engagementMin = parseFloat(searchParams.get("engagementMin") || "0");
  const engagementMax = parseFloat(searchParams.get("engagementMax") || "100");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
  const skip = (page - 1) * limit;

  // ── Build where ────────────────────────────────────────────────────────────
  const baseWhere: any = {
    platform: "youtube",
  };

  if (status) baseWhere.relevanceStatus = status;
  if (pillar) baseWhere.contentPillar = pillar;
  if (format) baseWhere.format = format;
  if (engagementMin > 0 || engagementMax < 100) {
    baseWhere.engagementRate = {
      ...(engagementMin > 0 ? { gte: engagementMin / 100 } : {}),
      ...(engagementMax < 100 ? { lte: engagementMax / 100 } : {}),
    };
  }
  if (channel) {
    baseWhere.competitor = { name: channel };
  }

  const where = search
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { contentPillar: { contains: search, mode: "insensitive" } },
              { mainTopic: { contains: search, mode: "insensitive" } },
              { competitor: { name: { contains: search, mode: "insensitive" } } },
            ],
          },
        ],
      }
    : baseWhere;

  // ── Fetch posts + stats ──────────────────────────────────────────────────
  const [posts, total, stats, allForDropdowns] = await Promise.all([
    prisma.post.findMany({
      where,
      include: { competitor: true },
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.post.count({ where }),
    // Stats for summary cards — đếm tất cả các trạng thái để hiển thị dashboard
    prisma.post.groupBy({
      by: ["relevanceStatus"],
      where: { platform: "youtube" },
      _count: { _all: true },
    }),
    // For dropdown filters
    prisma.post.findMany({
      where: { platform: "youtube" },
      select: {
        contentPillar: true,
        format: true,
        competitor: { select: { name: true } },
      },
      distinct: ["contentPillar", "format"],
    }),
  ]);

  // ── Build stats object ──────────────────────────────────────────────────
  const totalYoutube = stats.reduce((sum, s) => sum + s._count._all, 0);
  const pendingCount = stats.find((s) => s.relevanceStatus === "pending")?._count._all ?? 0;
  const relevantCount = stats.find((s) => s.relevanceStatus === "relevant")?._count._all ?? 0;
  const irrelevantCount = stats.find((s) => s.relevanceStatus === "irrelevant")?._count._all ?? 0;
  const aiScoredCount = relevantCount + irrelevantCount;

  // ── Unique dropdowns ───────────────────────────────────────────────────
  const uniqueChannels = [
    ...new Set(allForDropdowns.map((p) => p.competitor?.name).filter(Boolean)),
  ].sort() as string[];
  const uniquePillars = [
    ...new Set(allForDropdowns.map((p) => p.contentPillar).filter(Boolean)),
  ].sort() as string[];
  const uniqueFormats = [
    ...new Set(allForDropdowns.map((p) => p.format).filter(Boolean)),
  ].sort() as string[];

  return NextResponse.json({
    posts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    stats: {
      total: totalYoutube,
      relevant: relevantCount,
      irrelevant: irrelevantCount,
      pending: pendingCount,
      aiScored: aiScoredCount,
    },
    filters: {
      uniqueChannels,
      uniquePillars,
      uniqueFormats,
    },
  });
}

// ── PATCH: Cập nhật relevanceStatus (soft delete) ────────────────────────────
//
// Cơ chế hoạt động:
//   - Video luôn được GIỮ trong DB, chỉ đổi relevanceStatus.
//   - getLatestSnapshot() live-filter theo relevanceStatus mỗi lần đọc snapshot:
//       · irrelevant → bị loại khỏi Bubble chart / sampleVideos / mọi analytics
//       · pending / relevant → xuất hiện bình thường
//   - Kết quả:
//       · Mark "Không liên quan"  → biến mất khỏi Bubble chart ngay khi reload ✓
//       · Restore về pending/relevant → tự hiện lại trong Bubble chart ngay khi reload ✓
//       · Không gọi AI, không xóa snapshot, không tốn quota
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { ids, status } = body as {
      ids: string[];
      status: "pending" | "relevant" | "irrelevant";
    };

    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: "ids is required" }, { status: 400 });
    }
    if (!["pending", "relevant", "irrelevant"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await prisma.post.updateMany({
      where: { id: { in: ids } },
      data: { relevanceStatus: status },
    });

    // Xóa NL Query cache để thống kê bài viết & tương tác theo đối thủ làm mới ngay
    clearNLQueryContextCache();

    return NextResponse.json({ success: true, updated: ids.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
