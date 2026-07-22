/**
 * YouTube API Key Manager
 *
 * Hỗ trợ nhiều API key, round-robin, fallback khi key bị rate-limit
 * hoặc hết quota. Keys được lưu dưới dạng JSON array trong Setting
 * với key="youtubeApiKeys".
 */

import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/config";

export type YoutubeKeyEntry = {
  id: string;
  key: string;
  label: string;
  isActive: boolean;
  /** Thời điểm key bị coi là exhausted (rate-limit/quota), null = bình thường */
  exhaustedAt: number | null;
};

/**
 * Đọc danh sách YouTube API keys từ DB.
 * Fallback: nếu không có multi-key, đọc key cũ từ config/youtubeApiKey.
 */
export async function getYoutubeApiKeys(): Promise<YoutubeKeyEntry[]> {
  try {
    const raw = await prisma.setting.findUnique({ where: { key: "youtubeApiKeys" } });
    if (raw?.value) {
      const parsed = JSON.parse(raw.value) as YoutubeKeyEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  // Fallback: đọc key cũ
  const legacyKey = await getConfig("youtube_api_key");
  if (legacyKey) {
    return [{ id: "legacy", key: legacyKey, label: "Legacy Key", isActive: true, exhaustedAt: null }];
  }

  return [];
}

/**
 * Lưu danh sách YouTube API keys vào DB.
 */
export async function saveYoutubeApiKeys(keys: YoutubeKeyEntry[]): Promise<void> {
  await prisma.setting.upsert({
    where: { key: "youtubeApiKeys" },
    create: { key: "youtubeApiKeys", value: JSON.stringify(keys) },
    update: { value: JSON.stringify(keys) },
  });
}

/**
 * Lấy một API key khả dụng theo round-robin, bỏ qua key bị exhausted.
 * Nếu tất cả đều exhausted, reset và dùng key đầu tiên.
 */
export async function getAvailableApiKey(): Promise<string | null> {
  const keys = await getYoutubeApiKeys();
  if (keys.length === 0) return null;

  const now = Date.now();
  const EXHAUSTED_TIMEOUT = 60_000; // 60s sau mới thử lại key bị exhausted

  // Lọc key active + chưa exhausted hoặc đã hết thời gian chờ
  const available = keys.filter(
    (k) => k.isActive && (!k.exhaustedAt || now - k.exhaustedAt > EXHAUSTED_TIMEOUT)
  );

  if (available.length === 0) {
    // Tất cả đều exhausted — reset sau 60s, dùng key đầu tiên
    return keys[0]?.key || null;
  }

  // Round-robin: dùng lastUsedIndex từ memory
  const idx = nextKeyIndex(available.length);
  return available[idx]?.key || null;
}

// ─── In-memory round-robin index ──────────────────────────────────────────────

let _keyIndex = 0;

function nextKeyIndex(total: number): number {
  if (total === 0) return 0;
  _keyIndex = (_keyIndex + 1) % total;
  return _keyIndex;
}

/**
 * Đánh dấu một API key bị exhausted (rate-limit/quota).
 * Gọi sau khi nhận HTTP 403/429 từ YouTube API.
 */
export async function markKeyExhausted(apiKey: string): Promise<void> {
  const keys = await getYoutubeApiKeys();
  const updated = keys.map((k) =>
    k.key === apiKey ? { ...k, exhaustedAt: Date.now() } : k
  );
  await saveYoutubeApiKeys(updated);
}

/**
 * Log quota usage — có thể mở rộng để ghi vào DB sau này.
 */
let quotaCount = 0;
export function logQuotaUsage(key: string): void {
  quotaCount++;
  if (process.env.NODE_ENV === "development") {
    console.log(`[YouTubeKeyManager] Used key "${key.slice(0, 8)}..." (total calls: ${quotaCount})`);
  }
}

// ─── Compatibility: kiểm tra xem có ít nhất 1 key không ───────────────────────

export async function hasYoutubeApiKey(): Promise<boolean> {
  const keys = await getYoutubeApiKeys();
  return keys.some((k) => k.isActive);
}
