import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const topic = searchParams.get("topic") || "";
  const channel = searchParams.get("channel") || "";
  const format = searchParams.get("format") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
  const skip = (page - 1) * limit;

  // ── Build where clause ──────────────────────────────────────────────
  const baseWhere: any = {
    platform: "youtube",
    competitor: { source: "trong_nuoc" },
    // Loại trừ video đã đánh dấu "Không liên quan"
    NOT: { relevanceStatus: "irrelevant" },
  };

  if (topic) {
    baseWhere.contentPillar = topic;
  }
  if (channel) {
    baseWhere.competitor.name = channel;
  }
  if (format) {
    baseWhere.format = format;
  }

  // Search filter: wrap with AND to avoid conflicting with competitor relation
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

  // ── Fetch posts + total count ───────────────────────────────────────
  const [posts, total, allDomesticPosts] = await Promise.all([
    prisma.post.findMany({
      where,
      include: { competitor: true },
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.post.count({ where }),
    // Fetch ALL domestic youtube posts for outlier score + unique dropdowns
    prisma.post.findMany({
      where: {
        platform: "youtube",
        competitor: { source: "trong_nuoc" },
        NOT: { relevanceStatus: "irrelevant" },
      },
      select: {
        id: true,
        views: true,
        competitorId: true,
        publishedAt: true,
        contentPillar: true,
        competitor: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" },
    }),
  ]);

  // ── Compute Outlier Scores (same formula as analytics.ts) ───────────
  const outlierScores: Record<string, number> = {};
  const grouped: Record<string, typeof allDomesticPosts> = {};
  for (const p of allDomesticPosts) {
    (grouped[p.competitorId] ??= []).push(p);
  }
  for (const [, competitorPosts] of Object.entries(grouped)) {
    const sorted = competitorPosts.slice().sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    for (const post of sorted) {
      const otherPosts = sorted.filter((p) => p.id !== post.id).slice(0, 20);
      if (otherPosts.length < 3) {
        outlierScores[post.id] = 20;
        continue;
      }
      const views = otherPosts.map((p) => p.views).sort((a, b) => a - b);
      const mid = Math.floor(views.length / 2);
      const medianViews = views.length % 2 === 0 ? (views[mid - 1] + views[mid]) / 2 : views[mid];
      const multiplier = medianViews > 0 ? post.views / medianViews : 1.0;
      outlierScores[post.id] = Math.min(Math.round(multiplier * 20), 100);
    }
  }

  // ── Unique topics & channels for dropdowns ──────────────────────────
  const uniqueTopics = [...new Set(allDomesticPosts.map((p) => p.contentPillar).filter(Boolean))].sort() as string[];
  const uniqueChannels = [...new Set(allDomesticPosts.map((p) => p.competitor?.name).filter(Boolean))].sort() as string[];

  return NextResponse.json({
    posts,
    outlierScores,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    filters: {
      uniqueTopics,
      uniqueChannels,
    },
  });
}
