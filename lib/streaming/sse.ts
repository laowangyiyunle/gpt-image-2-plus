const encoder = new TextEncoder();

export type SseWriter = {
  send: (event: string, data: unknown) => void;
  close: () => void;
};

export function createSseResponse(
  handler: (writer: SseWriter) => Promise<void>
) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const writer: SseWriter = {
        send(event, data) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        },
        close() {
          controller.close();
        }
      };

      void handler(writer)
        .catch((error) => {
          writer.send("error", {
            error: error instanceof Error ? error.message : "请求失败"
          });
        })
        .finally(() => {
          writer.close();
        });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
