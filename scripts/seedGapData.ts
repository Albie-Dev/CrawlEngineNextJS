import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const platform = "youtube";
  const source = "trong_nuoc";

  // Helpers to generate fake dates
  const now = new Date();
  const dateDaysAgo = (days: number) => {
    const d = new Date();
    d.setDate(now.getDate() - days);
    return d.toISOString();
  };

  const fakeVideos = (count: number, channelBase: string, baseViews: number, baseEng: number, recent: boolean) => {
    return Array.from({ length: count }).map((_, i) => ({
      id: `vid_${Math.random().toString(36).substring(7)}`,
      title: `Bí quyết ${channelBase} phần ${i + 1}`,
      channelName: `${channelBase} Channel ${i % 3}`,
      views: baseViews + (Math.random() * baseViews * 0.5),
      engagementRate: baseEng + (Math.random() * baseEng * 0.2),
      thumbnailUrl: `https://picsum.photos/seed/${Math.random()}/320/180`,
      youtubeId: Math.random().toString(36).substring(2, 13),
      publishedAt: recent ? dateDaysAgo(Math.random() * 20) : dateDaysAgo(40 + Math.random() * 40),
    }));
  };

  const fakeTopic = (
    slug: string,
    name: string,
    videoCount: number,
    channelCount: number,
    medianViews: number,
    outlierRate: number,
    growthRate30d: number,
    totalViews: number,
    priority: "Cao" | "Trung bình" | "Thấp",
    recent: boolean
  ) => {
    return {
      slug,
      name,
      videoCount,
      channelCount,
      totalViews,
      avgEngagement: 0.15 + Math.random() * 0.1,
      medianViews,
      outlierRate,
      growthRate30d,
      competitionScore: videoCount / channelCount,
      priority,
      sampleVideos: fakeVideos(Math.min(10, videoCount), name, medianViews, 0.15, recent),
      detail: {
        competitionLevel: priority === "Cao" ? "Thấp" : "Cao",
        badge: priority === "Cao" ? "Cơ hội cao" : "Cạnh tranh cao",
        tagline: `Góc nhìn mới về ${name}`,
        channels: ["Channel A", "Channel B"],
        hooks: ["Bạn có biết...", "Sự thật về..."],
        contentAngles: ["Góc nhìn chuyên gia", "Dành cho người mới"],
      },
      deepDetail: {
        summary: `Chủ đề ${name} đang thu hút lượng lớn sự quan tâm.`,
        opportunity: "Tạo nội dung đào sâu vào thực hành.",
        scriptSuggestion: "Hook -> Vấn đề -> Giải pháp -> CTA",
        targetAudience: "Người đi làm 25-35 tuổi",
        risks: ["Nội dung dễ bị trùng lặp"],
        tactics: ["Sử dụng số liệu thực tế", "Storytelling"],
        generatedAt: new Date(),
      }
    };
  };

  // Top Left: High Perf, Low Comp
  const t1 = fakeTopic("top-left-1", "Kinh tế vĩ mô 2026", 10, 8, 250000, 0.35, 45, 2500000, "Cao", true); // Green
  const t2 = fakeTopic("top-left-2", "Đầu tư AI", 15, 10, 180000, 0.40, 20, 1800000, "Cao", true); // Green

  // Top Right: High Perf, High Comp
  const t3 = fakeTopic("top-right-1", "Phân tích kỹ thuật Crypto", 80, 20, 200000, 0.30, 5, 15000000, "Trung bình", true); // Yellow
  const t4 = fakeTopic("top-right-2", "Bất động sản dòng tiền", 60, 15, 150000, 0.25, -10, 9000000, "Trung bình", true); // Yellow

  // Bottom Left: Low Perf, Low Comp
  const t5 = fakeTopic("bottom-left-1", "Quản lý tài chính Gen Z", 8, 5, 20000, 0.05, 5, 160000, "Trung bình", true); // Yellow
  const t6 = fakeTopic("bottom-left-2", "Lãi suất tiết kiệm", 12, 10, 15000, 0.02, -25, 180000, "Thấp", false); // Red, older (60+ days)

  // Bottom Right: Low Perf, High Comp
  const t7 = fakeTopic("bottom-right-1", "Tin tức chứng khoán hàng ngày", 150, 40, 10000, 0.01, -30, 1500000, "Thấp", true); // Red
  const t8 = fakeTopic("bottom-right-2", "Dự báo giá vàng", 120, 35, 25000, 0.05, -5, 3000000, "Thấp", true); // Yellow

  // Additional varied topics
  const t9 = fakeTopic("mid-1", "ETF Việt Nam", 30, 12, 80000, 0.15, 18, 2400000, "Trung bình", true); // Green
  const t10 = fakeTopic("mid-2", "Cách dùng thẻ tín dụng", 40, 20, 45000, 0.10, -20, 1800000, "Thấp", false); // Red, older

  const snapshotData = {
    commonTopics: [t3, t7, t8],
    repeatedTopics: [t4, t10],
    underusedHighEngagement: [t1, t2],
    gaps: [t5, t6, t9],
    stats: {
      notableTopics: 15,
      notableTopicsTrend: 12,
      repeatedTopics: 42,
      repeatedTopicsTrend: -5,
      gaps: 8,
      gapsTrend: 20,
      dataNote: "Dữ liệu mô phỏng để test UI Ma trận cơ hội",
    }
  };

  await prisma.contentGapSnapshot.create({
    data: {
      platform,
      source,
      data: JSON.stringify(snapshotData),
      generatedAt: new Date(),
    }
  });

  console.log("✅ Seeded Content Gap Snapshot data successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
