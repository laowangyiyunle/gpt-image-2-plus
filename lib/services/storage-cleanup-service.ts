import fs from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/lib/db/sqlite";
import { removeStoredFile } from "@/lib/storage/file-storage";

const publicDir = path.join(process.cwd(), "public");
const storageKinds = ["generated", "uploads"] as const;

type StorageKind = (typeof storageKinds)[number];

function publicPathFor(kind: StorageKind, fileName: string) {
  return `/${kind}/${fileName}`;
}

async function listStoredPublicPaths() {
  const paths: string[] = [];

  for (const kind of storageKinds) {
    const dir = path.join(publicDir, kind);
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      if (!entry.isFile() || entry.name === ".gitkeep") {
        continue;
      }

      paths.push(publicPathFor(kind, entry.name));
    }
  }

  return paths;
}

function listReferencedPublicPaths() {
  const db = getDb();
  const rows = db
    .prepare(`SELECT file_path FROM image_assets`)
    .all() as Array<{ file_path: string }>;

  return new Set(rows.map((row) => row.file_path));
}

async function removePublicPaths(paths: string[]) {
  await Promise.all(
    paths.map((filePath) => removeStoredFile(filePath).catch(() => undefined))
  );
}

export async function getStorageCleanupStats() {
  const storedPaths = await listStoredPublicPaths();
  const referencedPaths = listReferencedPublicPaths();
  const orphanPaths = storedPaths.filter((filePath) => !referencedPaths.has(filePath));

  return {
    storedFiles: storedPaths.length,
    referencedFiles: referencedPaths.size,
    orphanFiles: orphanPaths.length
  };
}

export async function cleanupOrphanFiles() {
  const storedPaths = await listStoredPublicPaths();
  const referencedPaths = listReferencedPublicPaths();
  const orphanPaths = storedPaths.filter((filePath) => !referencedPaths.has(filePath));

  await removePublicPaths(orphanPaths);

  return {
    removedFiles: orphanPaths.length,
    ...(await getStorageCleanupStats())
  };
}

export async function clearAllHistoryAndFiles() {
  const db = getDb();
  const storedPaths = await listStoredPublicPaths();

  db.prepare(`DELETE FROM sessions`).run();
  await removePublicPaths(storedPaths);

  return {
    removedFiles: storedPaths.length,
    storedFiles: 0,
    referencedFiles: 0,
    orphanFiles: 0
  };
}
