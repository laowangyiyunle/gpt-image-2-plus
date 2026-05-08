export function isStreamingUnsupportedError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    message.includes("stream") ||
    message.includes("partial_images") ||
    message.includes("unsupported")
  );
}
