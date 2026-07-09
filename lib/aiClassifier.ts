/**
 * AI-Powered Auto-Tagging Engine
 *
 * Thay thế rule-based classifier bằng AI classification.
 * Fallback về rule-based nếu AI không available.
 */

import { isOpenAIConfigured, getOpenAIClient, getOpenAIModel } from "@/lib/openai";
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
