import { NextResponse } from "next/server";
import { deepAnalyzeTopic } from "@/lib/contentGapSnapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/content-gap/deep-analyze
 * Body: { topicSlug: string, platform?: string, source?: string }
 *
 * Gọi AI phân tích sâu hơn cho 1 topic, lưu vào DB snapshot.
 * Lần sau load lại → đọc từ DB, không gọi AI lại.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { topicSlug, platform = "youtube", source = "trong_nuoc" } = body as {
      topicSlug?: string;
      platform?: string;
      source?: string;
    };

    if (!topicSlug) {
      return NextResponse.json({ error: "topicSlug là bắt buộc" }, { status: 400 });
    }

    const deepDetail = await deepAnalyzeTopic(topicSlug, platform, source);

    if (!deepDetail) {
      return NextResponse.json(
        { error: "Không tìm thấy topic trong snapshot. Vui lòng chạy Sync để tạo dữ liệu mới." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, deepDetail });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
