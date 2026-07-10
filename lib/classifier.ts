import type { ClassifiedPost, Platform, RawPostInput } from "@/lib/types";
import { calculateEngagementRate, calculateViralityScore } from "@/lib/utils";

const includesAny = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(keyword.toLowerCase()));

const hasNumberHook = (text: string) => /(\d+[%x]?|\d{2,}|\btop\s?\d+\b)/i.test(text);

/**
 * Gộp tất cả nội dung có sẵn (title, caption, tags, transcript) thành một text
 * để phân loại chính xác hơn.
 */
function buildFullText(title: string, caption: string, tags?: string[], transcript?: string): string {
  const parts = [title, caption];
  if (tags?.length) parts.push(tags.join(" "));
  if (transcript) parts.push(transcript);
  return parts.join(" ").toLowerCase();
}

export function classifyPost(
  postTitle: string,
  caption: string,
  platform: Platform,
  tags?: string[],
  transcript?: string,
): ClassifiedPost {
  const title = postTitle.trim();
  const text = buildFullText(postTitle, caption, tags, transcript);

  let mainTopic = "Thị trường tài chính";
  if (includesAny(text, ["vàng", "gold", "xau", "xauusd", "giá vàng", "silver", "bạc"])) mainTopic = "Vàng";
  if (includesAny(text, ["bitcoin", "crypto", "eth", "btc", "binance", "altcoin"])) mainTopic = "Crypto";
  if (includesAny(text, ["fed", "lãi suất", "cpi", "gdp", "inflation", "recession", "vĩ mô", "macro"])) mainTopic = "Vĩ mô";
  if (includesAny(text, ["cổ phiếu", "chứng khoán", "vnindex", "vn-index", "stock", "equity"])) mainTopic = "Chứng khoán";
  if (includesAny(text, ["bất động sản", "real estate", "property"])) mainTopic = "Bất động sản";
  if (includesAny(text, ["rsi", "trendline", "price action", "indicator", "breakout", "elliott", "fibonacci"])) mainTopic = "Phân tích kỹ thuật";
  if (includesAny(text, ["tâm lý", "kỷ luật", "fomo", "sợ hãi", "hoảng loạn", "mindset"])) mainTopic = "Tâm lý đầu tư";

  // Rule-based fallback cho contentPillar, promotionType, toneOfVoice, hookType
  // Chỉ dùng khi AI không available (aiEnrichRawPost fallback)
  let contentPillar = mainTopic;
  let promotionType = "Không bán hàng";
  if (includesAny(text, ["khóa học", "course", "đăng ký học"])) promotionType = "Bán khóa học";
  if (includesAny(text, ["tham gia room", "room vip", "room vàng", "cộng đồng chuyên sâu"])) promotionType = "Bán room";
  if (includesAny(text, ["webinar", "nhận vé", "đăng ký webinar"])) promotionType = "Webinar";
  if (includesAny(text, ["livestream", "live tối nay", "live lúc"])) promotionType = "Livestream";
  if (includesAny(text, ["minigame", "giveaway", "quà tặng"])) promotionType = "Minigame";
  if (includesAny(text, ["ebook", "checklist", "template", "tài liệu miễn phí"])) promotionType = "Lead magnet";
  if (includesAny(text, ["combo", "ưu đãi", "giảm giá", "limited offer"])) promotionType = "Combo/ưu đãi";
  if (includesAny(text, ["inbox", "tư vấn", "để lại số điện thoại"])) promotionType = "CTA tư vấn";
  if (includesAny(text, ["tham gia cộng đồng", "group", "community"])) promotionType = "CTA tham gia cộng đồng";
  if (includesAny(text, ["follow", "theo dõi kênh", "subscribe", "đăng ký kênh"])) promotionType = "CTA theo dõi kênh";

  let toneOfVoice = "Trung tính";
  if (includesAny(text, ["đừng", "cẩn thận", "rủi ro", "sập", "hoảng loạn", "bẫy", "mất tiền"])) toneOfVoice = "Cảnh báo";
  if (includesAny(text, ["ngay", "khẩn", "chỉ còn", "đừng bỏ lỡ", "fomo", "cơ hội cuối"])) toneOfVoice = "FOMO";
  if (includesAny(text, ["hành trình", "truyền cảm hứng", "tự do tài chính", "thành công"])) toneOfVoice = "Truyền cảm hứng";

  let hookType = "Khác";
  if (/^\s*(vì sao|tại sao|how|why|what|làm sao|có nên|điều gì|\?)/i.test(title) || title.includes("?")) hookType = "Câu hỏi";
  if (hasNumberHook(text)) hookType = "Con số cụ thể";
  if (includesAny(text, ["tin nóng", "breaking", "vừa xảy ra", "khẩn"])) hookType = "Tin nóng";
  if (includesAny(text, ["case study", "backtest", "ví dụ thực tế", "trade này"])) hookType = "Case study";

  let format = "other";
  if (platform === "youtube") {
    format = includesAny(text, ["short", "60s", "1 phút", "#shorts"]) ? "short_video" : "long_video";
  }
  if (platform === "tiktok") format = "short_video";
  if (platform === "facebook") {
    format = includesAny(text, ["reel", "video ngắn"]) ? "reel" : "text_post";
    if (includesAny(text, ["carousel", "slide", "album"])) format = "carousel";
    if (includesAny(text, ["infographic", "ảnh", "image"])) format = "image_post";
  }
  if (includesAny(text, ["livestream", "live", "webinar"])) format = "livestream";

  return {
    contentPillar,
    promotionType,
    toneOfVoice,
    hookType,
    format,
    mainTopic
  };
}

export function enrichRawPost(rawPost: RawPostInput): RawPostInput & ClassifiedPost & { engagementRate: number; viralityScore: number } {
  const classified = classifyPost(rawPost.title, rawPost.caption, rawPost.platform, rawPost.tags, rawPost.transcript);
  const format = rawPost.format ?? classified.format;
  const engagementRate = calculateEngagementRate(rawPost, rawPost.platform);
  const viralityScore = calculateViralityScore(rawPost);
  return {
    ...rawPost,
    ...classified,
    format,
    engagementRate,
    viralityScore
  };
}
