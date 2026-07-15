/**
 * lib/youtubeRelevance.ts
 *
 * Shared AI relevance scoring logic for YouTube videos.
 * Used by:
 *   - Auto-scoring after sync (lib/sync.ts)
 *   - Manual batch scoring API (/api/youtube/relevance/ai-score)
 */

import { prisma } from "@/lib/prisma";
import { callAI } from "@/lib/openai";

export const RELEVANCE_TOPIC =
  "kinh tế, tài chính cá nhân, đầu tư (chứng khoán, vàng, tiền điện tử, bất động sản), phân tích thị trường, tiết kiệm, quản lý tài sản, tâm lý nhà đầu tư";

const BATCH_SIZE = 10;
const MAX_PER_RUN = 200;

type VideoInput = {
  id: string;
  title: string;
  caption: string;
  contentPillar: string;
  mainTopic: string;
};

type ScoreResult = {
  id: string;
  score: number;
  status: "relevant" | "irrelevant";
  note: string;
};

/**
 * Score a batch of videos via AI and return structured results.
 */
export async function scoreBatch(videos: VideoInput[]): Promise<ScoreResult[]> {
  const listText = videos
    .map(
      (v, i) =>
        `[${i + 1}] ID: ${v.id}\nTiêu đề: ${v.title}\nChủ đề: ${v.contentPillar} / ${v.mainTopic}\nMô tả: ${(v.caption || "").slice(0, 200)}`
    )
    .join("\n\n");

  const prompt = `Bạn là chuyên gia phân tích nội dung tài chính. Đánh giá mức độ liên quan của các video YouTube dưới đây với chủ đề: ${RELEVANCE_TOPIC}.

Trả về JSON array theo format (chỉ JSON, không text khác):
[{"id":"<video_id>","score":<0.0-1.0>,"status":"relevant"|"irrelevant","note":"<lý do ngắn 1 câu tiếng Việt>"}]

Quy tắc:
- score: 0.0 (không liên quan) → 1.0 (rất liên quan)  
- status = "relevant" nếu score >= 0.5, ngược lại "irrelevant"
- Các video về sức khỏe, du lịch, giải trí thuần túy, âm nhạc, thể thao → "irrelevant"
- Video về kinh doanh, tiền bạc, đầu tư, thị trường → "relevant"

Danh sách video:
${listText}`;

  const raw = await callAI([{ role: "user", content: prompt }], {
    maxTokens: 1500,
  });

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("AI không trả về JSON hợp lệ");
  }

  const parsed = JSON.parse(jsonMatch[0]) as ScoreResult[];
  return parsed;
}

/**
 * Auto-score all YouTube posts that haven't been scored yet.
 * Returns the number of posts that were scored.
 */
export async function autoScoreYouTubePosts(maxPosts = MAX_PER_RUN): Promise<number> {
  const pendingPosts = await prisma.post.findMany({
    where: {
      platform: "youtube",
      aiRelevanceScore: null,
    },
    select: {
      id: true,
      title: true,
      caption: true,
      contentPillar: true,
      mainTopic: true,
    },
    orderBy: { publishedAt: "desc" },
    take: maxPosts,
  });

  if (pendingPosts.length === 0) return 0;

  let scored = 0;

  for (let i = 0; i < pendingPosts.length; i += BATCH_SIZE) {
    const batch = pendingPosts.slice(i, i + BATCH_SIZE);

    try {
      const results = await scoreBatch(batch);

      await Promise.all(
        results.map((r) =>
          prisma.post.update({
            where: { id: r.id },
            data: {
              aiRelevanceScore: Math.max(0, Math.min(1, r.score)),
              relevanceStatus: r.status,
              relevanceNote: r.note,
            },
          })
        )
      );

      scored += batch.length;
    } catch {
      // Skip failed batch, continue with rest
    }

    // Slight delay between batches to avoid rate limits
    if (i + BATCH_SIZE < pendingPosts.length) {
      await new Promise((res) => setTimeout(res, 600));
    }
  }

  return scored;
}
