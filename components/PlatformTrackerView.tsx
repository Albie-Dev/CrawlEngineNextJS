import Link from "next/link";
import { Eye, MessageCircle, RadioTower, Users } from "lucide-react";
import { AddYoutubeCompetitorButton } from "@/components/AddYoutubeCompetitorButton";
import { LazyContentGapPanel } from "@/components/LazyContentGapPanel";
import { ContentOpportunityChart } from "@/components/ContentOpportunityChart";
import { CompetitorTable } from "@/components/CompetitorTable";
import { FilterBar } from "@/components/FilterBar";
import { MetricCard } from "@/components/MetricCard";
import { PlatformTabs } from "@/components/PlatformTabs";
import { PostTable } from "@/components/PostTable";
import { TopPostCard } from "@/components/TopPostCard";
import { getPlatformAnalytics } from "@/lib/analytics";
import { platformLabels } from "@/lib/constants";
import type { AnalyticsFilters, Platform } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

import { YouTubeForeignAnalysis } from "@/components/YouTubeForeignAnalysis";
import { YouTubeRelevanceTable } from "@/components/YouTubeRelevanceTable";
import { getLatestSnapshot } from "@/lib/contentGapSnapshot";

export async function PlatformTrackerView({
  platform,
  filters,
  title,
  subtitle
}: {
  platform: Platform;
  filters: AnalyticsFilters;
  title: string;
  subtitle: string;
}) {
  // Fetch unfiltered analytics for the ContentCountCard (ignore format param)
  const cardFilters = { ...filters, format: undefined };
  const cardAnalytics = await getPlatformAnalytics(platform, cardFilters);

  // Fetch analytics with all filters for the analysis sections
  const analytics = await getPlatformAnalytics(platform, filters);
  const ctaPosts = analytics.posts.filter((post) => post.promotionType !== "Không bán hàng").slice(0, 10);
  const gapData = await getLatestSnapshot(platform, "trong_nuoc");
  const topics = gapData?.snapshot 
    ? [
        ...gapData.snapshot.commonTopics,
        ...gapData.snapshot.repeatedTopics,
        ...gapData.snapshot.underusedHighEngagement,
        ...gapData.snapshot.gaps
      ].filter((t, i, arr) => arr.findIndex((x) => x.slug === t.slug) === i)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-kolia-green">{platformLabels[platform]}</p>
          <h1 className="mt-2 text-3xl font-bold text-kolia-ink dark:text-slate-100">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {platform === "youtube" ? <AddYoutubeCompetitorButton /> : null}
          <PlatformTabs active={platform} />
        </div>
      </div>

      <FilterBar filters={filters} lockPlatform={platform} />

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-2">
        <MetricCard title="Đối thủ đang theo dõi" value={formatNumber(analytics.totalCompetitors)} detail={`Chỉ tính các kênh thuộc ${platformLabels[platform]} trong danh sách đã import.`} icon={<Users className="h-5 w-5" />} />

        {platform === "youtube" ? (
          <ContentCountCard
            platform={platform}
            total={cardAnalytics.totalPosts}
            shortCount={cardAnalytics.posts.filter((p) => p.format === "short_video").length}
            longCount={cardAnalytics.posts.filter((p) => p.format === "long_video").length}
          />
        ) : (
          <MetricCard title="Nội dung đã thu thập" value={formatNumber(analytics.totalPosts)} detail="Chỉ bao gồm nội dung đã publish, không lấy video đang chờ phát hoặc chưa công khai." icon={<RadioTower className="h-5 w-5" />} />
        )}
      </div>

      <ContentOpportunityChart topics={topics} />

      {platform !== "youtube" && (
        <section className="rounded border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="text-base font-bold text-kolia-ink dark:text-slate-100">Nội dung có tỷ lệ người xem tương tác cao</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Tỷ lệ tương tác = (like + comment + share) / lượt xem. Không dùng điểm lan tỏa nội bộ ở phần này.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {analytics.topPosts.slice(0, 4).map((post, index) => (
              <TopPostCard key={post.id} post={post} rank={index + 1} />
            ))}
          </div>
        </section>
      )}

      {platform === "youtube" ? (
        <YouTubeAnalysis analytics={analytics} platform={platform} filters={filters} />
      ) : platform === "tiktok" ? (
        <TikTokAnalysis analytics={analytics} platform={platform} />
      ) : (
        <FacebookAnalysis analytics={analytics} ctaPosts={ctaPosts} platform={platform} />
      )}

      <details className="group rounded-lg border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-5 py-4 select-none hover:bg-slate-50 dark:hover:bg-slate-800 transition">
          <h2 className="text-base font-bold text-kolia-ink dark:text-slate-100">Tổng bài viết và tương tác theo đối thủ</h2>
          <svg className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="border-t border-kolia-line dark:border-slate-800 p-5">
          <CompetitorTable summaries={analytics.competitorSummaries} lockPlatform={platform} />
        </div>
      </details>

      {platform === "youtube" ? (
        <details className="group rounded-lg border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <summary className="flex cursor-pointer items-center justify-between gap-2 px-5 py-4 select-none hover:bg-slate-50 dark:hover:bg-slate-800 transition">
            <div>
              <h2 className="text-base font-bold text-kolia-ink dark:text-slate-100">Bảng nội dung nổi bật trên YouTube</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Bảng giúp bạn phân tích đối thủ, chủ đề, hook/tone và hiệu suất để tối ưu chiến lược nội dung.</p>
            </div>
            <svg className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </summary>
          <div className="border-t border-kolia-line dark:border-slate-800 p-5">
            <YouTubeRelevanceTable />
          </div>
        </details>
      ) : (
        <PostTable posts={analytics.topPosts} hideShare={false} title={`Bảng nội dung nổi bật trên ${platformLabels[platform]} theo trụ cột nội dung, link gốc và phân loại`} />
      )}
    </div>
  );
}

function ContentCountCard({ platform, total, shortCount, longCount }: { platform: string; total: number; shortCount: number; longCount: number }) {
  return (
    <section className="rounded border border-borderColor bg-bgSecondary p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-textMuted">Nội dung đã thu thập</p>
          <p className="mt-2 text-2xl font-bold text-textPrimary">{formatNumber(total)}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded bg-kolia-mint dark:bg-emerald-900/40 text-kolia-green">
          <RadioTower className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href={`/${platform}?format=short_video#phan-tich-video`}
          className="rounded px-2 py-1.5 text-center block transition-colors bg-kolia-mint dark:bg-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-800/50"
        >
          <p className="text-sm font-bold text-kolia-green dark:text-emerald-300">{formatNumber(shortCount)}</p>
          <p className="text-xs text-textSecondary dark:text-slate-400">Video ngắn</p>
        </Link>
        <Link
          href={`/${platform}?format=long_video#phan-tich-video`}
          className="rounded px-2 py-1.5 text-center block transition-colors bg-kolia-amber dark:bg-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-800/50"
        >
          <p className="text-sm font-bold text-kolia-gold dark:text-amber-300">{formatNumber(longCount)}</p>
          <p className="text-xs text-textSecondary dark:text-slate-400">Video dài</p>
        </Link>
      </div>
      <p className="mt-4 text-sm leading-6 text-textSecondary">Chỉ bao gồm nội dung đã publish, không lấy video đang chờ phát hoặc chưa công khai.</p>
    </section>
  );
}

function YouTubeAnalysis({ analytics, platform, filters }: { analytics: Awaited<ReturnType<typeof getPlatformAnalytics>>; platform: Platform; filters: AnalyticsFilters }) {
  const isVideoFilter = filters.format === "long_video" || filters.format === "short_video";
  return (
    <div className="space-y-8">
      {/* ─── Content gap đối thủ trong nước ──────────────────────────────── */}
      <details className="group rounded-lg border border-borderColor bg-bgSecondary" open>
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-5 py-4 select-none hover:bg-bgTertiary transition">
          <div>
            <h2 className="text-base font-bold text-textPrimary">Content gap đối thủ trong nước</h2>
            <p className="text-sm text-textMuted">Tìm cơ hội nội dung bằng cách phân tích các chủ đề top view từ kênh Việt Nam</p>
          </div>
          <svg className="h-4 w-4 shrink-0 text-textMuted transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="border-t border-borderColor p-5">
          <LazyContentGapPanel platform={platform} hasData={analytics.totalPosts > 0} />
        </div>
      </details>

      {/* ─── Phân tích video nước ngoài ──────────────────────────────────── */}
      <details id="phan-tich-video" className="group rounded-lg border border-borderColor bg-bgSecondary" open={isVideoFilter ? true : undefined}>
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-5 py-4 select-none hover:bg-bgTertiary transition">
          <div>
            <h2 className="text-base font-bold text-textPrimary">Phân tích video nước ngoài</h2>
            <p className="text-sm text-textMuted">Tìm video viral từ kênh quốc tế và trích xuất format để tái tạo tại Việt Nam</p>
          </div>
          <svg className="h-4 w-4 shrink-0 text-textMuted transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="border-t border-borderColor p-5">
          <YouTubeForeignAnalysis domesticPosts={analytics.posts} initialFormat={filters.format ?? ""} />
        </div>
      </details>

      {/* ─── Phân tích video trong nước ──────────────────────────────────── */}
      <details className="group rounded-lg border border-borderColor bg-bgSecondary" open={isVideoFilter ? true : undefined}>
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-5 py-4 select-none hover:bg-bgTertiary transition">
          <div>
            <h2 className="text-base font-bold text-textPrimary">Phân tích video trong nước</h2>
            <p className="text-sm text-textMuted">Phân tích cấu trúc, format và hiệu suất video từ kênh YouTube Việt Nam</p>
          </div>
          <svg className="h-4 w-4 shrink-0 text-textMuted transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="border-t border-borderColor p-5">
          <YouTubeForeignAnalysis variant="domestic" domesticPosts={analytics.posts} initialFormat={filters.format ?? ""} />
        </div>
      </details>
    </div>
  );
}


function TikTokAnalysis({ analytics, platform }: { analytics: Awaited<ReturnType<typeof getPlatformAnalytics>>; platform: Platform }) {
  const tiktokLines = [
    "Tuyến giải thích thị trường vàng dễ hiểu trong 60s.",
    "Tuyến tâm lý nhà đầu tư: FOMO, sợ hãi, kỷ luật vốn.",
    "Tuyến cảnh báo sai lầm phổ biến khi trade vàng/crypto.",
    "Tuyến reaction tin nóng Fed, CPI, BTC, XAU.",
    "Tuyến mini case study: một quyết định giao dịch và bài học rút ra."
  ];

  return (
    <div className="space-y-6">
      <details className="group rounded-lg border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm" open>
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-5 py-4 select-none hover:bg-slate-50 dark:hover:bg-slate-800 transition">
          <div>
            <h2 className="text-xl font-extrabold text-kolia-ink dark:text-slate-100">Content gap đối thủ trong nước</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tìm cơ hội nội dung bằng cách phân tích các chủ đề top view từ kênh Việt Nam</p>
          </div>
          <svg className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="border-t border-kolia-line dark:border-slate-800 p-5">
          <LazyContentGapPanel platform={platform} hasData={analytics.totalPosts > 0} />
        </div>
      </details>
      <section className="rounded border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h2 className="text-base font-bold text-kolia-ink dark:text-slate-100">Gợi ý tuyến TikTok cho Kolia</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {tiktokLines.map((line) => (
            <div key={line} className="rounded border border-kolia-line dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-300">
              {line}
            </div>
          ))}
        </div>
      </section>
      <section className="rounded border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h2 className="text-base font-bold text-kolia-ink dark:text-slate-100">Video hiệu quả theo từng trụ cột nội dung và công thức triển khai</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {analytics.topByPillar.slice(0, 8).map((group) => (
            <div key={group.pillar} className="rounded border border-kolia-line dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
              <h3 className="font-bold text-kolia-green">{group.pillar}</h3>
              <div className="mt-3 space-y-3">
                {group.posts.map((post) => (
                  <a key={post.id} href={post.postUrl} target="_blank" rel="noreferrer" className="block rounded bg-white dark:bg-slate-900 p-3 text-sm hover:text-kolia-green">
                    <span className="font-semibold text-kolia-ink dark:text-slate-100">{post.title}</span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                      Công thức: {post.hookType} → {post.mainTopic} → giải thích ngắn → lời mời theo dõi
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FacebookAnalysis({
  analytics,
  ctaPosts,
  platform
}: {
  analytics: Awaited<ReturnType<typeof getPlatformAnalytics>>;
  ctaPosts: Awaited<ReturnType<typeof getPlatformAnalytics>>["posts"];
  platform: Platform;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="text-base font-bold text-kolia-ink dark:text-slate-100">Nhóm lời kêu gọi hành động được dùng nhiều nhất</h2>
          <div className="mt-4 space-y-3">
            {analytics.topPromotionTypes.slice(0, 6).map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{item.name}</span>
                <span className="font-bold text-kolia-green">{formatNumber(item.count)} bài</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="text-base font-bold text-kolia-ink dark:text-slate-100">Bài có CTA bán khóa học/room/webinar</h2>
          <div className="mt-4 space-y-3">
            {ctaPosts.map((post) => (
              <a key={post.id} href={post.postUrl} target="_blank" rel="noreferrer" className="block rounded border border-kolia-line dark:border-slate-800 p-3 text-sm hover:bg-kolia-mint">
                <span className="font-semibold text-kolia-ink dark:text-slate-100">{post.title}</span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{post.competitor.name} · {post.promotionType}</span>
              </a>
            ))}
          </div>
        </section>
      </div>
      <details className="group rounded-lg border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm" open>
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-5 py-4 select-none hover:bg-slate-50 dark:hover:bg-slate-800 transition">
          <div>
            <h2 className="text-xl font-extrabold text-kolia-ink dark:text-slate-100">Content gap đối thủ trong nước</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tìm cơ hội nội dung bằng cách phân tích các chủ đề top view từ kênh Việt Nam</p>
          </div>
          <svg className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="border-t border-kolia-line dark:border-slate-800 p-5">
          <LazyContentGapPanel platform={platform} hasData={analytics.totalPosts > 0} />
        </div>
      </details>
    </div>
  );
}
