import { YoutubeTranscript, TranscriptResponse } from "youtube-transcript";

/**
 * Format time in seconds to [MM:SS]
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const padMins = String(mins).padStart(2, "0");
  const padSecs = String(secs).padStart(2, "0");
  return `[${padMins}:${padSecs}]`;
}

/**
 * Extract transcript items into formatted text
 */
function formatTranscriptItems(
  items: TranscriptResponse[],
  format: "plain_text" | "timestamps"
): string {
  if (!items || items.length === 0) return "";
  if (format === "timestamps") {
    return items
      .map((item) => `${formatTime(item.offset / 1000)} ${item.text}`)
      .join("\n");
  }
  return items.map((item) => item.text).join(" ");
}

/**
 * Strategy 1: Using youtube-transcript library
 */
async function tryYoutubeTranscript(
  videoId: string
): Promise<TranscriptResponse[] | null> {
  // Try Vietnamese first, then default
  try {
    return await YoutubeTranscript.fetchTranscript(videoId, { lang: "vi" });
  } catch {
    try {
      return await YoutubeTranscript.fetchTranscript(videoId);
    } catch {
      return null;
    }
  }
}

/**
 * Strategy 2: Using youtubetranscript.com free API (no key needed, more reliable)
 * Bun's fetch is available globally.
 */
async function tryYoutubetranscriptCom(
  videoId: string
): Promise<TranscriptResponse[] | null> {
  try {
    const res = await fetch(
      `https://youtubetranscript.com/?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data) return null;
    // API may return array directly or { title, transcript: [...] }
    const items = Array.isArray(data) ? data : data?.transcript;
    if (!items || !Array.isArray(items) || items.length === 0) return null;
    return items.map((item: any) => ({
      text: item.text || "",
      duration: item.duration || 0,
      offset: (item.start || 0) * 1000,
      lang: "en",
    }));
  } catch {
    return null;
  }
}

/**
 * Strategy 3: Try youtube-transcript with additional language codes
 * Some videos only have captions in specific languages not auto-detected.
 */
async function tryYoutubeTranscriptMoreLangs(
  videoId: string
): Promise<TranscriptResponse[] | null> {
  const extraLangs = ["en", "vi", "ja", "ko", "zh-Hans", "zh-Hant", "es", "fr", "de", "pt", "ru", "ar", "th", "id"];
  for (const lang of extraLangs) {
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId, { lang });
      if (items && items.length > 0) return items;
    } catch {
      // continue to next language
    }
  }
  return null;
}

/**
 * Strategy 4: YouTube Data API — list caption tracks then download via timedtext API
 * Uses API key to find available caption languages, then fetches directly from
 * YouTube's timedtext endpoint (more reliable than the library for some videos).
 */
async function tryYoutubeDataApi(
  videoId: string
): Promise<TranscriptResponse[] | null> {
  try {
    const { getAvailableApiKey, logQuotaUsage, markKeyExhausted } = await import("@/lib/youtubeKeyManager");
    const apiKey = await getAvailableApiKey();
    if (!apiKey) return null;
    logQuotaUsage(apiKey);

    // List caption tracks
    const listRes = await fetch(
      `https://youtube.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!listRes.ok) {
      if (listRes.status === 403 || listRes.status === 429) {
        await markKeyExhausted(apiKey);
      }
      return null;
    }
    const listData = await listRes.json();
    const items = listData?.items;
    if (!items || items.length === 0) return null;

    // Collect unique languages from available tracks
    const langs = new Set<string>();
    for (const item of items) {
      if (item.snippet?.language) langs.add(item.snippet.language);
    }

    // Prioritize: vi → en → others
    const priority = ["vi", "en", ...Array.from(langs).filter(l => l !== "vi" && l !== "en")];

    for (const lang of priority) {
      try {
        // Fetch directly from YouTube's timedtext API
        const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const data = await res.json();
        if (!data?.events || !Array.isArray(data.events)) continue;

        const items: TranscriptResponse[] = [];
        for (const event of data.events) {
          if (!event?.segs || !Array.isArray(event.segs)) continue;
          for (const seg of event.segs) {
            if (seg?.utf8) {
              items.push({
                text: seg.utf8,
                duration: (event.durationMs || event.duration || 0) / 1000,
                offset: (event.tStartMs || event.tStart || 0) / 1000,
                lang,
              });
            }
          }
        }
        if (items.length > 0) return items;
      } catch {
        continue;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch and format YouTube video transcript.
 * Uses multiple strategies (cascade fallback):
 *   1. youtube-transcript library (fastest, try vi then default)
 *   2. youtubetranscript.com (free API, no key needed)
 *   3. youtube-transcript with 14 additional languages
 *   4. YouTube Data API v3 captions listing + youtube-transcript (requires API key)
 */
export async function fetchAndFormatTranscript(
  videoId: string,
  options: {
    format?: "plain_text" | "timestamps";
    onLog?: (msg: string) => void;
  } = {}
): Promise<string> {
  const format = options.format || "timestamps";
  const onLog = options.onLog;

  // ── Strategy 1: youtube-transcript ────────────────────────────────────
  onLog?.(`📡 [1/4] Đang thử youtube-transcript cho ${videoId}...`);
  let items = await tryYoutubeTranscript(videoId);
  if (items) {
    onLog?.(`✅ [1/4] youtube-transcript thành công.`);
    return formatTranscriptItems(items, format);
  }

  // ── Strategy 2: youtubetranscript.com ─────────────────────────────────
  onLog?.(`⚠️ [1/4] Thất bại. Thử [2/4] youtubetranscript.com...`);
  items = await tryYoutubetranscriptCom(videoId);
  if (items) {
    onLog?.(`✅ [2/4] youtubetranscript.com thành công.`);
    return formatTranscriptItems(items, format);
  }

  // ── Strategy 3: More languages ────────────────────────────────────────
  onLog?.(`⚠️ [2/4] Thất bại. Thử [3/4] thêm 14 ngôn ngữ khác...`);
  items = await tryYoutubeTranscriptMoreLangs(videoId);
  if (items) {
    onLog?.(`✅ [3/4] Tìm thấy phụ đề ở ngôn ngữ khác.`);
    return formatTranscriptItems(items, format);
  }

  // ── Strategy 4: YouTube Data API ──────────────────────────────────────
  onLog?.(`⚠️ [3/4] Thất bại. Thử [4/4] YouTube Data API...`);
  items = await tryYoutubeDataApi(videoId);
  if (items) {
    onLog?.(`✅ [4/4] YouTube Data API thành công.`);
    return formatTranscriptItems(items, format);
  }

  onLog?.(`❌ Cả 4 phương pháp đều thất bại cho video ${videoId}.`);
  throw new Error(`Không thể tải phụ đề cho video ${videoId}: cả 4 phương pháp đều thất bại.`);
}
