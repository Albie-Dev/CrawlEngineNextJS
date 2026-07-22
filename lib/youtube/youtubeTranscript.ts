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
    if (!data || !Array.isArray(data)) return null;
    return data.map((item: any) => ({
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
 * Strategy 3: Using YouTube Data API v3 captions (requires API key)
 */
async function tryYoutubeDataApi(
  videoId: string
): Promise<TranscriptResponse[] | null> {
  try {
    const { getConfig } = await import("@/lib/config");
    const apiKey = await getConfig("youtube_api_key");
    if (!apiKey) return null;

    // Step 1: List caption tracks
    const listRes = await fetch(
      `https://youtube.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!listRes.ok) return null;
    const listData = await listRes.json();
    const items = listData?.items;
    if (!items || items.length === 0) return null;

    // Prefer Vietnamese, then English, then first available
    const track =
      items.find((i: any) => i.snippet?.language === "vi") ||
      items.find((i: any) => i.snippet?.language === "en") ||
      items[0];

    const trackId = track?.id;
    if (!trackId) return null;

    // Step 2: Download the caption track
    const downloadRes = await fetch(
      `https://youtube.googleapis.com/youtube/v3/captions/${trackId}?key=${apiKey}&tfmt=sbv`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!downloadRes.ok) return null;

    const captionText = await downloadRes.text();
    if (!captionText) return null;

    // Parse SBV format: "0:00:05.000,0:00:10.000\nHello world\n\n"
    const lines: TranscriptResponse[] = [];
    const blocks = captionText.split(/\n\n+/);
    for (const block of blocks) {
      const [timeLine, ...textLines] = block.trim().split("\n");
      if (!timeLine || !textLines.length) continue;
      const timeMatch = timeLine.match(
        /^(\d+):(\d{2}):(\d{2})\.\d+,\d+:\d{2}:\d{2}\.\d+$/
      );
      if (!timeMatch) continue;
      const offsetMs =
        parseInt(timeMatch[1]) * 3600000 +
        parseInt(timeMatch[2]) * 60000 +
        parseInt(timeMatch[3]) * 1000;
      lines.push({
        text: textLines.join(" "),
        duration: 0,
        offset: offsetMs,
        lang: track.snippet?.language || "en",
      });
    }
    return lines.length > 0 ? lines : null;
  } catch {
    return null;
  }
}

/**
 * Fetch and format YouTube video transcript.
 * Uses multiple strategies (cascade fallback):
 *   1. youtube-transcript library (fastest)
 *   2. youtubetranscript.com (free API, no key needed)
 *   3. YouTube Data API v3 captions (requires API key)
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
  onLog?.(`📡 [1/3] Đang thử youtube-transcript cho ${videoId}...`);
  let items = await tryYoutubeTranscript(videoId);
  if (items) {
    onLog?.(`✅ [1/3] youtube-transcript thành công.`);
    return formatTranscriptItems(items, format);
  }

  // ── Strategy 2: youtubetranscript.com ─────────────────────────────────
  onLog?.(`⚠️ [1/3] Thất bại. Thử [2/3] youtubetranscript.com...`);
  items = await tryYoutubetranscriptCom(videoId);
  if (items) {
    onLog?.(`✅ [2/3] youtubetranscript.com thành công.`);
    return formatTranscriptItems(items, format);
  }

  // ── Strategy 3: YouTube Data API ──────────────────────────────────────
  onLog?.(`⚠️ [2/3] Thất bại. Thử [3/3] YouTube Data API...`);
  items = await tryYoutubeDataApi(videoId);
  if (items) {
    onLog?.(`✅ [3/3] YouTube Data API thành công.`);
    return formatTranscriptItems(items, format);
  }

  onLog?.(`❌ Cả 3 phương pháp đều thất bại cho video ${videoId}.`);
  throw new Error(`Không thể tải phụ đề cho video ${videoId}: cả 3 phương pháp đều thất bại.`);
}
