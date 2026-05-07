import path from "node:path";

export function safeJoin(baseDir: string, fileName: string) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(path.join(baseDir, fileName));

  if (
    resolvedTarget !== resolvedBase &&
    !resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)
  ) {
    throw new Error("Unsafe path detected");
  }

  return resolvedTarget;
}

export function buildStoredFileName(prefix: string, extension: string) {
  const safeExtension = extension.replace(/^\./, "").toLowerCase() || "bin";
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExtension}`;
}
