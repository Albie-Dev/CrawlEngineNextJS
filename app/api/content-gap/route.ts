import { NextResponse } from "next/server";
import { getLatestSnapshot, refreshContentGapSnapshot } from "@/lib/contentGapSnapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") ?? "youtube";
  const source = searchParams.get("source") ?? "trong_nuoc";

  // Đọc snapshot từ DB (cache — không gọi AI)
  let result = null;
  try {
    result = await getLatestSnapshot(platform, source);
  } catch (err) {
    console.error("[content-gap API] Lỗi đọc snapshot (có thể do chưa chạy migration):", err);
  }

  if (result) {
    return NextResponse.json({
      domestic: result.snapshot,
      generatedAt: result.generatedAt.toISOString(),
      fromCache: true,
    });
  }

  // Chưa có snapshot: trigger generate async, trả skeleton
  (async () => {
    try {
      await refreshContentGapSnapshot(platform, source);
    } catch {
      // silent
    }
  })();

  return NextResponse.json({
    domestic: null,
    generatedAt: null,
    fromCache: false,
    message: "Đang tổng hợp phân tích lần đầu — vui lòng thử lại sau 30 giây.",
  });
}

/**
 * POST: Trigger thủ công refresh snapshot (từ nút "Phân tích thủ công" trong Settings)
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") ?? "youtube";
  const source = searchParams.get("source") ?? "trong_nuoc";

  try {
    await refreshContentGapSnapshot(platform, source);
    const result = await getLatestSnapshot(platform, source);
    return NextResponse.json({ ok: true, generatedAt: result?.generatedAt?.toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
