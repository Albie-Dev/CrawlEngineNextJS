import { NextResponse } from "next/server";
import { aiVideoFormula } from "@/lib/aiClassifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "";
  const format = searchParams.get("format") || "long_video";
  const mainTopic = searchParams.get("mainTopic") || "Thị trường tài chính";
  const transcript = searchParams.get("transcript") || "";

  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const result = await aiVideoFormula(title, format, mainTopic, transcript);
  return NextResponse.json(result);
}
