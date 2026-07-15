import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scoreBatch } from "@/lib/youtubeRelevance";

const BATCH_SIZE = 10;

// ── POST: Trigger AI batch scoring (SSE stream) ──────────────────────────────
export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Find all YouTube posts not yet AI-scored
        const pendingPosts = await prisma.post.findMany({
          where: {
            platform: "youtube",
            aiRelevanceScore: null,
          },
          select: {
            id: true,
            title: true,
            caption: true,
            contentPillar: true,
            mainTopic: true,
          },
          orderBy: { publishedAt: "desc" },
          take: 200, // cap per run
        });

        const total = pendingPosts.length;
        send({ type: "start", total });

        if (total === 0) {
          send({
            type: "complete",
            processed: 0,
            message: "Tất cả video đã được AI chấm điểm.",
          });
          controller.close();
          return;
        }

        let processed = 0;
        const errors: string[] = [];

        // Process in batches
        for (let i = 0; i < pendingPosts.length; i += BATCH_SIZE) {
          const batch = pendingPosts.slice(i, i + BATCH_SIZE);

          try {
            const results = await scoreBatch(batch);

            // Save results to DB
            await Promise.all(
              results.map((r) =>
                prisma.post.update({
                  where: { id: r.id },
                  data: {
                    aiRelevanceScore: Math.max(0, Math.min(1, r.score)),
                    relevanceStatus: r.status,
                    relevanceNote: r.note,
                  },
                })
              )
            );

            processed += batch.length;
            send({
              type: "progress",
              processed,
              total,
              percent: Math.round((processed / total) * 100),
            });
          } catch (batchErr: any) {
            errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchErr.message}`);
            processed += batch.length;
            send({
              type: "progress",
              processed,
              total,
              percent: Math.round((processed / total) * 100),
              batchError: batchErr.message,
            });
          }

          // Small delay between batches
          if (i + BATCH_SIZE < pendingPosts.length) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        send({ type: "complete", processed, total, errors });
      } catch (err: any) {
        send({ type: "error", message: err.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
