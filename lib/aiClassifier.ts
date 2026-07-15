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

    const textParts: string[] = [];

    // 1. Tiêu đề - quan trọng nhất
    textParts.push(`TIÊU ĐỀ: ${title}`);

    // 2. Hashtags từ caption và tags
    const hashtags = [
      ...(tags ?? []),
      ...(caption.match(/#\w+/g) ?? []),
    ].map((t) => t.replace(/^#/, "")).filter((t, i, a) => a.indexOf(t) === i).slice(0, 15);
    if (hashtags.length) textParts.push(`HASHTAGS: ${hashtags.join(", ")}`);

    // 3. Transcript - cắt thông minh: lấy đầu (giới thiệu) + cuối (kết luận)
    if (transcript) {
      const maxLen = 4000;
      if (transcript.length > maxLen) {
        const head = transcript.slice(0, 2000);
        const tail = transcript.slice(-1500);
        textParts.push(`NỘI DUNG VIDEO (đầu):\n${head}\n\n...(giữa bị lược bỏ)...\n\nNỘI DUNG VIDEO (cuối):\n${tail}`);
      } else {
        textParts.push(`NỘI DUNG VIDEO:\n${transcript}`);
      }
    }

    // 4. Description - cắt ngắn
    const shortCaption = caption.length > 300 ? caption.slice(0, 300) + "..." : caption;
    if (shortCaption) textParts.push(`MÔ TẢ: ${shortCaption}`);

    const text = textParts.join("\n\n").slice(0, 6000);

    const response = await client.responses.create({
      model,
      input: text,
      instructions: `Phân tích nội dung video YouTube này. Trả về JSON:

{
  "contentPillar": "tên ngắn gọn (≤5 từ) phân loại NỘI DUNG CHÍNH. Thứ tự ưu tiên: 1) transcript (quan trọng nhất) 2) tiêu đề 3) tags 4) mô tả. KHÔNG dùng tên cảm xúc/tone giọng. Ví dụ tốt: 'Cập nhật thị trường', 'Phân tích kỹ thuật', 'Case study giao dịch', 'Tâm lý đầu tư', 'Giáo dục cơ bản', 'Tin nóng', 'Phát triển tư duy', 'Review sách'. Ví dụ KHÔNG tốt: 'Truyền cảm hứng', 'Cảnh báo', 'Chuyên gia' (đây là tone giọng, không phải nội dung)",
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
      max_output_tokens: 5000,
    });

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
  console.warn(`[ai-classifier] ⚠️ AI trả về rỗng hoặc không parse được JSON, fallback rule-based cho: "${title.slice(0, 60)}"`);
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
    const statsJson = JSON.stringify({ pillars: pillarStats, overallAvgEngagement });
    const prompt = `Dữ liệu: ${statsJson}

Trả về JSON (chỉ JSON, không suy luận):
{"commonTopics":["3-5 chủ đề phổ biến"],"repeatedTopics":["2-3 chủ đề lặp lại, engagement thấp"],"underusedHighEngagement":["2-3 chủ đề ít làm, tiềm năng cao"],"gaps":["3-5 khoảng trống nội dung"],"suggestions":["3-5 gợi ý tuyến nội dung"]}`;

    onLog?.("🤖 [AI Content Gap] Đang phân tích dữ liệu...");
    const response = await callAI([
      { role: "system" as const, content: "Chuyên gia phân tích nội dung tài chính. Trả lời ngắn gọn, chỉ JSON." },
      { role: "user" as const, content: prompt },
    ], { maxTokens: 5000 });
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

// ─── AI Foreign Formula Analysis ─────────────────────────────────────────

export type AIForeignFormulaResult = {
  viralPatterns: string[];
  koliaFormats: string[];
};

export async function aiForeignFormula(
  foreignPostCount: number,
  topShortTitles: string[],
  topLongTitles: string[],
): Promise<AIForeignFormulaResult> {
  if (!await isOpenAIConfigured() || foreignPostCount === 0) {
    return {
      viralPatterns: ["Chưa có đủ dữ liệu đối thủ nước ngoài để phân tích."],
      koliaFormats: ["Thu thập thêm dữ liệu để AI đề xuất định dạng phù hợp."],
    };
  }

  try {
    const prompt = `Phân tích ${foreignPostCount} video YouTube đối thủ nước ngoài.

Video ngắn: ${topShortTitles.join("; ") || "không có"}
Video dài: ${topLongTitles.join("; ") || "không có"}

Trả về JSON TIẾNG VIỆT (chỉ JSON, không suy luận):
{"viralPatterns": ["4-6 pattern ngắn, tiếng Việt"], "koliaFormats": ["3-5 định dạng cho Kolia, tiếng Việt"]}`;

    const response = await callAI([
      { role: "system" as const, content: "Chuyên phân tích nội dung YouTube. Luôn trả lời TIẾNG VIỆT. Chỉ JSON." },
      { role: "user" as const, content: prompt },
    ], { maxTokens: 5000 });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        viralPatterns: parsed.viralPatterns ?? [],
        koliaFormats: parsed.koliaFormats ?? [],
      };
    }
  } catch (e) {
    console.warn("[ai-foreign-formula] AI failed:", e);
  }

  return {
    viralPatterns: ["Mở bằng căng thẳng thị trường → framework đơn giản → bằng chứng trực quan → kết thúc bằng lời mời học tập."],
    koliaFormats: ["Video ngắn 60 giây phân tích một chỉ số/dữ kiện.", "Video dài 12-18 phút: luận điểm → dữ liệu → kịch bản."],
  };
}

export type HighlightItem = {
  timestamp: string;  // VD: "00:08" hoặc "12:30"
  timeRange?: string; // Khoảng thời gian cụ thể, VD: "00:08 - 01:25"
  title: string;      // Dòng tóm tắt ngắn (hiển thị mặc định)
  detail: string;     // Mô tả chi tiết hơn khi expand
};

export type AIVideoFormula = {
  summary: string;    // Tóm tắt tổng quan video 2-3 câu
  formatViral: {
    titleTemplate: string;
    hookPattern: string;
    corePromise: string;
    contentAngle: string;
    style: string;
  };
  timeline?: Array<{ time: string; title: string; script: string; role: string }>;
  editingAndEffects: string[];
  contentBrief: {
    topic: string;
    angle: string;
    keyPoints: string;
    cta: string;
  };
  highlights: HighlightItem[];
  tags: string[];
  channelProfile: {
    contentStyle: string;
    targetAudience: string;
    strengths: string;
    worthFollowing: "Có" | "Không" | "Tuỳ mục đích";
    reason: string;
  };
  vietnamized: string;
  isDeepAnalysis?: boolean;
};

export async function aiVideoFormula(
  title: string,
  format: string,
  mainTopic: string,
  transcript?: string,
  isDeepAnalysis: boolean = false,
  duration?: number | null  // thời lượng video tính bằng giây
): Promise<AIVideoFormula> {
  if (!await isOpenAIConfigured()) {
    return {
      summary: "Chưa phân tích được - Vui lòng cấu hình AI API để bắt đầu phân tích.",
      formatViral: {
        titleTemplate: "Chưa phân tích được",
        hookPattern: format === "short_video" ? "Hook → Vấn đề → Giải thích → Kết luận" : "Luận điểm → Dữ liệu → Phân tích → Kết luận",
        corePromise: "Chưa phân tích được",
        contentAngle: "Chưa phân tích được",
        style: "Chưa phân tích được"
      },
      timeline: [],
      editingAndEffects: ["B-roll", "Zoom cut nhanh"],
      contentBrief: {
        topic: title,
        angle: "Phân tích số liệu",
        keyPoints: "1. Vấn đề\n2. Phân tích\n3. Giải pháp",
        cta: "Đăng ký kênh"
      },
      highlights: [],
      tags: [],
      channelProfile: {
        contentStyle: "Chưa phân tích",
        targetAudience: "Chưa phân tích",
        strengths: "Chưa phân tích",
        worthFollowing: "Tuỳ mục đích",
        reason: "Chưa phân tích"
      },
      vietnamized: "Việt hóa dựa trên nội dung gốc.",
      isDeepAnalysis: false
    };
  }

  let actualIsDeepAnalysis = isDeepAnalysis;

  // Format thời lượng để truyền vào prompt
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m} phút ${s}s` : `${m} phút`;
  };
  const durationLabel = duration ? formatDuration(duration) : null;

  const parts = [
    `TIÊU ĐỀ: ${title}`,
    `CHỦ ĐỀ: ${mainTopic}`,
    ...(durationLabel ? [`THỜI LƯỢNG VIDEO: ${durationLabel} (${duration}s)`] : []),
  ];
  
  if (transcript) {
    if (!isDeepAnalysis && transcript.length > 12000) {
      // Smart Chunking (Option 2): Tiết kiệm token cho video dài > 20 phút
      const head = transcript.slice(0, 4000);
      const midStart = Math.floor(transcript.length / 2) - 2000;
      const midEnd = Math.floor(transcript.length / 2) + 2000;
      const mid = transcript.slice(midStart, midEnd);
      const tail = transcript.slice(-4000);
      parts.push(`TRANSCRIPT:\n${head}\n\n[...ĐÃ LƯỢC BỎ GIỮA VIDEO ĐỂ TIẾT KIỆM TOKEN...]\n\n${mid}\n\n[...ĐÃ LƯỢC BỎ...]\n\n${tail}`);
    } else {
      // Deep Analysis (Option 1) hoặc video ngắn: Gửi full nội dung, max 150.000 ký tự (~4-5 tiếng)
      parts.push(`TRANSCRIPT:\n${transcript.slice(0, 150000)}`);
      // Nếu video ngắn (<= 12000) thì mặc định là đã phân tích toàn bộ (SÂU)
      actualIsDeepAnalysis = true;
    }
  } else {
    actualIsDeepAnalysis = true; // Không có transcript thì không có gì để cắt, coi như đã phân tích hết
  }

  const input = parts.join("\n\n");

  const prompt = `${input}

Phân tích video này và bóc tách cấu trúc nội dung. Trả về JSON TIẾNG VIỆT (chỉ JSON thuần, không markdown) theo đúng format:
{
  "summary": "Tóm tắt tổng quan video trong 2-3 câu súc tích, nêu được điểm đặc biệt khiến video này nổi bật",
  "formatViral": {
    "titleTemplate": "Mẫu tiêu đề tổng quát có thể tái sử dụng",
    "hookPattern": "Cách video mở đầu giữ chân người xem",
    "corePromise": "Giá trị cụ thể người xem nhận được sau khi xem hết",
    "contentAngle": "Góc tiếp cận / luận điểm độc đáo của tác giả",
    "style": "Phong cách truyền đạt (VD: Chuyên gia phân tích, kể chuyện, dữ liệu + ví dụ)"
  },
  "timeline": [
    { "time": "0-3s", "title": "Tên đoạn", "script": "Tóm tắt nội dung đoạn này", "role": "Hook | Thiết lập vấn đề | Bằng chứng | Giải pháp | CTA | v.v." },
    { "time": "3-15s", "title": "Tên đoạn", "script": "Tóm tắt nội dung", "role": "vai trò" }
  ],
  "editingAndEffects": ["3-5 kỹ thuật edit nổi bật giúp giữ chân người xem"],
  "contentBrief": {
    "topic": "Chủ đề cốt lõi",
    "angle": "Cách triển khai",
    "keyPoints": "3-4 ý chính quan trọng nhất",
    "cta": "CTA được sử dụng hoặc đề xuất"
  },
  "highlights": [
    {
      "timestamp": "00:08",
      "timeRange": "Khoảng thời gian cụ thể (VD: 00:08 - 01:25)",
      "title": "Dòng tóm tắt ngắn nhất có thể của đoạn/ý này (1 câu)",
      "detail": "Mô tả chi tiết hơn nội dung của đoạn này, tại sao nó quan trọng (2-3 câu)"
    }
  ],
  "tags": ["6-10 từ khoá / thẻ tag mô tả chủ đề, ngành, phong cách"],
  "channelProfile": {
    "contentStyle": "Phong cách nội dung của kênh",
    "targetAudience": "Đối tượng khán giả",
    "strengths": "Điểm mạnh của kênh",
    "worthFollowing": "Có",
    "reason": "Lý do 1-2 câu"
  },
  "vietnamized": "Gợi ý 1-2 câu áp dụng format này cho kênh Việt Nam"
}

QUAN TRỌNG - Quy tắc timeline:
${durationLabel ? `- Video dài ${durationLabel} — timeline PHẢI bao phủ từ đầu đến cuối (0 → ${durationLabel}).` : "- Timeline phải bao phủ toàn bộ thời lượng video từ đầu đến cuối."}
- Mỗi đoạn timeline phải có nhãn "role" mô tả đúng vai trò thực tế của đoạn đó trong video (tự phân tích từ nội dung, không dùng nhãn cố định).
- Số lượng đoạn: ${format === "short_video" ? "5-8 đoạn tính bằng giây (ví dụ: 0-3s, 3-12s, 12-28s...)" : "6-12 đoạn tính bằng phút:giây (ví dụ: 0:00-0:45, 0:45-2:30...)"}.
- KHÔNG được dừng giữa chừng. Đoạn cuối PHẢI kết thúc đúng thời điểm cuối video.`;

  const response = await callAI([
    { role: "system" as const, content: "Chuyên gia phân tích nội dung YouTube. Luôn trả lời bằng TIẾNG VIỆT. Chỉ output raw JSON object, không bọc trong markdown tick marks." },
    { role: "user" as const, content: prompt },
  ], { maxTokens: 8192 });

  console.log(`[ai-video-formula] Response for "${title.slice(0, 50)}":`, response.slice(0, 200));
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summary: parsed.summary || "",
      formatViral: parsed.formatViral || {
        titleTemplate: "N/A", hookPattern: "N/A", corePromise: "N/A", contentAngle: "N/A", style: "N/A"
      },
      timeline: parsed.timeline || [],
      editingAndEffects: parsed.editingAndEffects || [],
      contentBrief: parsed.contentBrief || {
        topic: "N/A", angle: "N/A", keyPoints: "N/A", cta: "N/A"
      },
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.map((h: any) => typeof h === "string"
            ? { timestamp: "", timeRange: "", title: h, detail: h }  // backward compat
            : { timestamp: h.timestamp || "", timeRange: h.timeRange || "", title: h.title || "", detail: h.detail || h.title || "" }
          )
        : [],
      tags: parsed.tags || [],
      channelProfile: parsed.channelProfile || {
        contentStyle: "N/A",
        targetAudience: "N/A",
        strengths: "N/A",
        worthFollowing: "Tuỳ mục đích",
        reason: "Chưa phân tích được"
      },
      vietnamized: parsed.vietnamized || "",
      isDeepAnalysis: actualIsDeepAnalysis,
    };
  }

  throw new Error(`[ai-video-formula] Không thể parse JSON response cho "${title.slice(0, 50)}"`);
}
