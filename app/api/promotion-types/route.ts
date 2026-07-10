import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { Platform } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") as Platform | null;

  const where = platform ? { platform } : {};

  const types = await prisma.post.findMany({
    where,
    select: { promotionType: true },
    distinct: ["promotionType"],
    orderBy: { promotionType: "asc" },
  });

  return NextResponse.json(types.map((t) => t.promotionType).filter(Boolean));
}
