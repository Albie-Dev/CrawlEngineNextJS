import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETTINGS_KEY = "content_gap_auto_refresh";

/**
 * GET /api/content-gap/settings
 * Trả về cấu hình auto refresh hiện tại.
 */
export async function GET() {
  const setting = await prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
  const value = setting ? JSON.parse(setting.value) : { autoRefresh: true };
  return NextResponse.json(value);
}

/**
 * POST /api/content-gap/settings
 * Body: { autoRefresh: boolean }
 * Lưu cấu hình auto refresh.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { autoRefresh } = body as { autoRefresh?: boolean };

  if (typeof autoRefresh !== "boolean") {
    return NextResponse.json({ error: "autoRefresh phải là boolean" }, { status: 400 });
  }

  await prisma.setting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: JSON.stringify({ autoRefresh }) },
    create: { key: SETTINGS_KEY, value: JSON.stringify({ autoRefresh }) },
  });

  return NextResponse.json({ ok: true, autoRefresh });
}
