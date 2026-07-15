import { NextResponse } from "next/server";
import { aiVideoFormula } from "@/lib/aiClassifier";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { postId, forceReanalyze = false, isDeepAnalysis = false } = body;

    if (!postId) {
      return NextResponse.json({ error: "Missing postId" }, { status: 400 });
    }

    // Lấy thông tin bài viết từ database
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Nếu không force và đã có kết quả AI phân tích trong DB thì trả về ngay
    // Tuy nhiên, nếu user bấm "Phân tích SÂU" (isDeepAnalysis=true), thì bỏ qua cache và force chạy lại
    if (!forceReanalyze && !isDeepAnalysis && post.aiAnalysis) {
      try {
        const existingAnalysis = JSON.parse(post.aiAnalysis);
        return NextResponse.json(existingAnalysis);
      } catch (e) {
        console.warn(`[analyze-video] Không thể parse aiAnalysis hiện tại cho post ${postId}, sẽ chạy lại AI.`);
      }
    }

    // Gọi AI phân tích
    const result = await aiVideoFormula(
      post.title,
      post.format || "long_video",
      post.mainTopic || "Thị trường tài chính",
      post.transcript || "",
      isDeepAnalysis,
      post.duration ?? null
    );

    // Lưu kết quả vào DB
    await prisma.post.update({
      where: { id: postId },
      data: {
        aiAnalysis: JSON.stringify(result)
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error(`[analyze-video] AI failed:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
