import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { postId } = await request.json();
    if (!postId) {
      return NextResponse.json({ error: "Missing postId" }, { status: 400 });
    }

    // Get post from DB
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, postUrl: true, transcript: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Extract video ID from postUrl
    const videoId = extractYoutubeVideoId(post.postUrl);
    if (!videoId) {
      return NextResponse.json({ error: "Cannot extract video ID from URL" }, { status: 400 });
    }

    // Fetch transcript
    const { fetchAndFormatTranscript } = await import("@/lib/youtube/youtubeTranscript");
    const transcript = await fetchAndFormatTranscript(videoId);

    if (!transcript) {
      return NextResponse.json({ error: "Could not fetch transcript for this video" }, { status: 404 });
    }

    // Update DB
    await prisma.post.update({
      where: { id: postId },
      data: { transcript },
    });

    return NextResponse.json({ ok: true, transcript });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fetch-transcript] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function extractYoutubeVideoId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
