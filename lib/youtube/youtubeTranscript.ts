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
 * Fetch and format YouTube video transcript.
 * Supports auto-translation via OpenAI if the transcript is not in Vietnamese.
 */
export async function fetchAndFormatTranscript(
  videoId: string,
  options: {
    format?: "plain_text" | "timestamps";
    onLog?: (msg: string) => void;
  } = {}
): Promise<string> {
  const format = options.format || "plain_text";
  const onLog = options.onLog;

  let transcriptItems: TranscriptResponse[] = [];

  // Step 1: Thử lấy phụ đề tiếng Việt trước
  try {
    onLog?.(`📡 Đang tải phụ đề tiếng Việt trực tiếp cho video ${videoId}...`);
    transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: "vi" });
    onLog?.(`✅ Đã tải phụ đề tiếng Việt thành công.`);
  } catch {
    onLog?.(`⚠️ Không tìm thấy phụ đề tiếng Việt trực tiếp. Thử lấy phụ đề mặc định...`);
    try {
      transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      onLog?.(`✅ Đã tải phụ đề mặc định.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onLog?.(`❌ Lỗi tải phụ đề từ YouTube: ${msg}`);
      throw new Error(`Không thể tải phụ đề cho video ${videoId}: ${msg}`);
    }
  }

  if (!transcriptItems || transcriptItems.length === 0) {
    return "";
  }

  // Step 2: Định dạng dữ liệu (Timestamps hoặc Plain Text)
  let formattedText = "";
  if (format === "timestamps") {
    formattedText = transcriptItems
      .map((item) => `${formatTime(item.offset / 1000)} ${item.text}`)
      .join("\n");
  } else {
    // plain_text: Ghép nối các dòng phụ đề lại
    formattedText = transcriptItems.map((item) => item.text).join(" ");
  }

  return formattedText;
}
