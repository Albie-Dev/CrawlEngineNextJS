import { NextResponse } from "next/server";
import { callAI } from "@/lib/openai";

export async function POST(req: Request) {
  try {
    const { texts } = await req.json();
    if (!texts || !Array.isArray(texts)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const prompt = `Dịch các đoạn văn sau sang tiếng Việt một cách tự nhiên. Trả về một mảng JSON các chuỗi tương ứng (chỉ JSON, không markdown).
Đầu vào:
${JSON.stringify(texts)}`;

    const response = await callAI([
      { role: "system", content: "You are a helpful translator. Return ONLY a valid JSON array of strings." },
      { role: "user", content: prompt }
    ], { maxTokens: 4000 });

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const translated = JSON.parse(jsonMatch[0]);
      return NextResponse.json({ translated });
    }
    
    return NextResponse.json({ error: "Could not parse JSON" }, { status: 500 });
  } catch (error: any) {
    console.error("[translate API]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
