import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { CORTEX_DIR } from "./constants.ts";

const DB_PATH = path.join(CORTEX_DIR, "hashes.json");

export type HashDB = Record<string, string>;

/** Normalizes path separators to forward slashes for cross-platform hashDB keys. */
export function normalizeKey(p: string): string {
  return p.replace(/\\/g, "/");
}

export function md5(data: Buffer): string {
  return createHash("md5").update(data).digest("hex");
}

export async function loadHashDB(): Promise<HashDB> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) return {};
    return parsed as HashDB;
  } catch {
    return {};
  }
}

/** Returns true if the dest file exists and its hash doesn't match the stored hash (user edited it). */
export async function isDirty(db: HashDB, destPath: string): Promise<boolean> {
  const stored = db[normalizeKey(destPath)];
  if (!stored) return false; // first sync — not dirty
  try {
    const data = await fs.readFile(destPath);
    return md5(data) !== stored;
  } catch {
    return false; // file doesn't exist yet — not dirty
  }
}

export async function saveHashDB(db: HashDB): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  const data = JSON.stringify(db, null, 2) + "\n";
  const tmp = DB_PATH + ".tmp";
  try {
    await fs.writeFile(tmp, data, "utf8");
    await fs.rename(tmp, DB_PATH);
  } catch (err) {
    await fs.unlink(tmp).catch(() => {});
    throw err;
  }
}
