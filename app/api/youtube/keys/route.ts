import { NextResponse } from "next/server";
import { getYoutubeApiKeys, saveYoutubeApiKeys } from "@/lib/youtubeKeyManager";

/**
 * GET /api/youtube/keys
 * Trả về danh sách YouTube API keys.
 */
export async function GET() {
  try {
    const keys = await getYoutubeApiKeys();
    // Mask key for security in response
    const masked = keys.map((k) => ({
      ...k,
      key: k.key,
    }));
    return NextResponse.json(masked);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * PUT /api/youtube/keys
 * Lưu danh sách YouTube API keys.
 * Body: { keys: [{ id, key, label, isActive, exhaustedAt }] }
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { keys } = body;
    if (!Array.isArray(keys)) {
      return NextResponse.json({ error: "keys must be an array" }, { status: 400 });
    }
    await saveYoutubeApiKeys(keys);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
