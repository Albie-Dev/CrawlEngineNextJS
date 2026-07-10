import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { Platform } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") as Platform | null;

  const where = platform ? { platform } : {};

  const pillars = await prisma.post.findMany({
    where,
    select: { contentPillar: true },
    distinct: ["contentPillar"],
    orderBy: { contentPillar: "asc" },
  });

  return NextResponse.json(pillars.map((p) => p.contentPillar).filter(Boolean));
}
