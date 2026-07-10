/**
 * AI-Powered Auto-Tagging Engine
 *
 * Thay thế rule-based classifier bằng AI classification.
 * Fallback về rule-based nếu AI không available.
 */

import { isOpenAIConfigured, getOpenAIClient, getOpenAIModel, callAI } from "@/lib/openai";
import { classifyPost, enrichRawPost } from "@/lib/classifier";
import { calculateEngagementRate, calculateViralityScore } from "@/lib/utils";
import type { ClassifiedPost, Platform, RawPostInput } from "@/lib/types";

export type AIClassifiedPost = ClassifiedPost & {
  sentiment: "positive" | "neutral" | "negative" | "fear";
  targetAudience: string;
  confidence: number;
  tags: string[];
  summary: string;
};

/**
 * AI-powered classification — thay thế hoàn toàn rule-based khi có OpenAI
 * Fallback về rule-based khi không có API key
 */
export async function aiClassifyPost(
  title: string,
  caption: string,
  platform: Platform,
  transcript?: string,
  tags?: string[],
): Promise<AIClassifiedPost> {
  // Fallback: dùng rule-based classifier
  if (!await isOpenAIConfigured()) {
    console.log("[ai-classifier] ❌ OpenAI CHƯA configured, fallback rule-based");
    const ruleResult = classifyPost(title, caption, platform, tags, transcript);
    return {
      ...ruleResult,
      sentiment: "neutral",
      targetAudience: "Nhà đầu tư cá nhân",
      confidence: 0.5,
      tags: [ruleResult.mainTopic, ruleResult.contentPillar],
      summary: title.slice(0, 200),
    };
  }

  try {
    const client = await getOpenAIClient();
    const model = await getOpenAIModel();

    const textParts = [
      `TIÊU ĐỀ: ${title}`,
      `MÔ TẢ: ${caption}`,
    ];
    if (tags?.length) textParts.push(`TAGS: ${tags.join(", ")}`);
    if (transcript) textParts.push(`PHỤ ĐỀ: ${transcript}`);
    const text = textParts.join("\n\n").slice(0, 8000);

    console.log("=== [ai-classifier] PROMPT GỬI LÊN AI ===");
    console.log(`Model: ${model}`);
    console.log(`Input (${text.length} chars):`);
    console.log(text.slice(0, 2000) + (text.length > 2000 ? "\n...(truncated)..." : ""));
    console.log("=== END PROMPT ===");

    const response = await client.responses.create({
      model,
      input: text,
      instructions: `Phân tích nội dung video YouTube này dựa trên tiêu đề, mô tả, tags và phụ đề. Trả về JSON:

{
  "contentPillar": "Phân tích vĩ mô|Phân tích kỹ thuật|Giáo dục đầu tư cơ bản|Case study giao dịch|Tâm lý đầu tư|Livestream/Webinar|Bán khóa học|Bán room cộng đồng|Minigame/Community engagement|Review sách/tài liệu|Tin nóng|Cảnh báo rủi ro|Phát triển tư duy tài chính|Cập nhật thị trường",
  "promotionType": "Không bán hàng|Bán khóa học|Bán room|Webinar|Livestream|Minigame|Lead magnet|Combo/ưu đãi|CTA tư vấn|CTA tham gia cộng đồng|CTA theo dõi kênh",
  "toneOfVoice": "Chuyên gia|Cảnh báo|Giáo dục dễ hiểu|Gấp gáp/FOMO|Trấn an|Phản biện|Truyền cảm hứng|Cộng đồng|Bán hàng trực tiếp|Bán hàng mềm",
  "hookType": "Dự đoán xu hướng|Câu hỏi gây tò mò|Cảnh báo rủi ro|Con số cụ thể|Tin nóng|Góc nhìn trái chiều|Case study|Lời hứa kết quả|Vấn đề phổ biến của nhà đầu tư|So sánh trước/sau",
  "mainTopic": "Vàng|Crypto|Vĩ mô|Chứng khoán|Bất động sản|Phân tích kỹ thuật|Tâm lý đầu tư|Thị trường tài chính",
  "sentiment": "positive|neutral|negative|fear",
  "targetAudience": "string",
  "tags": ["tag1", "tag2"],
  "summary": "tóm tắt 1 câu",
  "confidence": 0.0-1.0
}

Chỉ trả về JSON, không markdown.`,
      max_output_tokens: 2000,
    });

    console.log("=== [ai-classifier] RAW RESPONSE TỪ AI ===");
    console.log(response.output_text ?? "(empty response)");
    console.log("=== END RESPONSE ===");

    const rawText = response.output_text || "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        contentPillar: parsed.contentPillar || "Cập nhật thị trường",
        promotionType: parsed.promotionType || "Không bán hàng",
        toneOfVoice: parsed.toneOfVoice || "Chuyên gia",
        hookType: parsed.hookType || "Dự đoán xu hướng",
        format: parsed.format || "other",
        mainTopic: parsed.mainTopic || "Thị trường tài chính",
        sentiment: parsed.sentiment || "neutral",
        targetAudience: parsed.targetAudience || "Nhà đầu tư cá nhân",
        confidence: parsed.confidence || 0.7,
        tags: parsed.tags || [],
        summary: parsed.summary || title.slice(0, 200),
      };
    }
  } catch (error) {
    console.warn("[ai-classifier] AI failed, falling back to rule-based:", error);
  }

  // Fallback
  const ruleResult = classifyPost(title, caption, platform, tags, transcript);
  return {
    ...ruleResult,
    sentiment: "neutral",
    targetAudience: "Nhà đầu tư cá nhân",
    confidence: 0.5,
    tags: [ruleResult.mainTopic, ruleResult.contentPillar],
    summary: title.slice(0, 200),
  };
}

/**
 * Batch AI classification — xử lý nhiều post cùng lúc
 */
export async function aiClassifyBatch(
  posts: Array<{ title: string; caption: string; platform: Platform; transcript?: string; tags?: string[] }>,
  concurrency = 3
): Promise<AIClassifiedPost[]> {
  const results: AIClassifiedPost[] = [];

  for (let i = 0; i < posts.length; i += concurrency) {
    const batch = posts.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((p) => aiClassifyPost(p.title, p.caption, p.platform, p.transcript, p.tags))
    );
    for (const result of batchResults) {
      results.push(
        result.status === "fulfilled"
          ? result.value
          : {
              ...classifyPost("", "", "youtube"),
              sentiment: "neutral" as const,
              targetAudience: "Nhà đầu tư",
              confidence: 0.3,
              tags: [],
              summary: "",
            }
      );
    }
  }

  return results;
}

/**
 * AI-powered enrichment — thay thế rule-based enrichRawPost trong sync pipeline.
 * Dùng AI để classify, fallback về rule-based nếu AI lỗi hoặc không available.
 */
export async function aiEnrichRawPost(
  rawPost: RawPostInput,
  onLog?: (message: string) => void,
): Promise<RawPostInput & ClassifiedPost & { engagementRate: number; viralityScore: number }> {
  const aiAvailable = await isOpenAIConfigured();

  try {
    if (aiAvailable) {
      onLog?.(`🧠 [AI] Đang phân loại: "${rawPost.title.slice(0, 80)}"...`);
    }
    const aiResult = await aiClassifyPost(rawPost.title, rawPost.caption, rawPost.platform, rawPost.transcript, rawPost.tags);
    const engagementRate = calculateEngagementRate(rawPost, rawPost.platform);
    const viralityScore = calculateViralityScore(rawPost);

    onLog?.(
      aiAvailable
        ? `✅ [AI] Phân loại xong: ${aiResult.contentPillar} | Hook: ${aiResult.hookType} | Tone: ${aiResult.toneOfVoice}`
        : `⚙️ [Rule-based] Phân loại: ${aiResult.contentPillar} | Hook: ${aiResult.hookType} | Tone: ${aiResult.toneOfVoice}`
    );

    return {
      ...rawPost,
      contentPillar: aiResult.contentPillar,
      promotionType: aiResult.promotionType,
      toneOfVoice: aiResult.toneOfVoice,
      hookType: aiResult.hookType,
      format: rawPost.format || aiResult.format,
      mainTopic: aiResult.mainTopic,
      engagementRate,
      viralityScore,
    };
  } catch {
    if (aiAvailable) {
      onLog?.(`⚠️ [AI] Lỗi, fallback về rule-based: "${rawPost.title.slice(0, 80)}"`);
    }
    return enrichRawPost(rawPost);
  }
}

// ─── AI Content Gap Analysis ─────────────────────────────────────────────

export type AIContentGapResult = {
  commonTopics: string[];
  repeatedTopics: string[];
  underusedHighEngagement: string[];
  gaps: string[];
  suggestions: string[];
};

/**
 * AI-powered content gap analysis — thay thế buildDomesticGap cứng nhắc.
 * Gửi thống kê pillar lên AI để phân tích thông minh.
 */
export async function aiContentGapAnalysis(
  pillarStats: Array<{ name: string; count: number; avgEngagement: number; totalViews: number }>,
  overallAvgEngagement: number,
  onLog?: (message: string) => void,
): Promise<AIContentGapResult> {
  if (!await isOpenAIConfigured()) {
    return buildFallbackGap(pillarStats, overallAvgEngagement);
  }

  try {
    const statsJson = JSON.stringify({ pillars: pillarStats, overallAvgEngagement }, null, 2);
    const prompt = `Phân tích dữ liệu trụ cột nội dung đối thủ trong nước dưới đây và đưa ra nhận định chiến lược.

DỮ LIỆU:
${statsJson}

Yêu cầu trả về JSON (chỉ JSON, không markdown):
{
  "commonTopics": ["3-5 chủ đề phổ biến nhất, giải thích ngắn tại sao"],
  "repeatedTopics": ["2-3 chủ đề bị lặp lại nhiều nhưng engagement thấp, kèm lý do"],
  "underusedHighEngagement": ["2-3 chủ đề ít được làm nhưng có tiềm năng tương tác cao"],
  "gaps": ["3-5 khoảng trống nội dung mà Kolia có thể khai thác"],
  "suggestions": ["3-5 gợi ý tuyến nội dung/chương trình cụ thể, sáng tạo"]
}

Phân tích phải dựa trên số liệu thực tế, viết bằng tiếng Việt tự nhiên, chuyên nghiệp, mang tính chiến lược.`;

    onLog?.("🤖 [AI Content Gap] Đang phân tích dữ liệu...");
    const response = await callAI([
      { role: "system" as const, content: "Bạn là chuyên gia phân tích chiến lược nội dung tài chính cấp enterprise." },
      { role: "user" as const, content: prompt },
    ], { maxTokens: 1500 });
    onLog?.("✅ [AI Content Gap] Phân tích hoàn tất.");

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        commonTopics: parsed.commonTopics ?? [],
        repeatedTopics: parsed.repeatedTopics ?? [],
        underusedHighEngagement: parsed.underusedHighEngagement ?? [],
        gaps: parsed.gaps ?? [],
        suggestions: parsed.suggestions ?? [],
      };
    }
  } catch (error) {
    console.warn("[ai-content-gap] AI failed, falling back:", error);
    onLog?.("⚠️ [AI Content Gap] Lỗi, dùng phân tích cơ bản.");
  }

  return buildFallbackGap(pillarStats, overallAvgEngagement);
}

function buildFallbackGap(
  pillarStats: Array<{ name: string; count: number; avgEngagement: number; totalViews: number }>,
  overallAvgEngagement: number,
): AIContentGapResult {
  const counts = pillarStats.map((p) => p.count).sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)] ?? 0;

  return {
    commonTopics: pillarStats.slice(0, 5).map((p) => p.name),
    repeatedTopics: pillarStats
      .filter((p) => p.count > median && p.avgEngagement <= overallAvgEngagement)
      .slice(0, 3)
      .map((p) => `${p.name} xuất hiện ${p.count} lần nhưng engagement chỉ ${(p.avgEngagement * 100).toFixed(1)}%, thấp hơn trung bình ${(overallAvgEngagement * 100).toFixed(1)}%.`),
    underusedHighEngagement: pillarStats
      .filter((p) => p.count <= Math.max(1, median) && p.avgEngagement >= overallAvgEngagement)
      .slice(0, 3)
      .map((p) => `${p.name} chỉ có ${p.count} bài nhưng engagement đạt ${(p.avgEngagement * 100).toFixed(1)}% — cơ hội tốt để khai thác sâu.`),
    gaps: ["Chưa đủ dữ liệu để xác định khoảng trống nội dung."],
    suggestions: ["Thu thập thêm dữ liệu đối thủ để AI đưa ra gợi ý chiến lược chính xác."],
  };
}
