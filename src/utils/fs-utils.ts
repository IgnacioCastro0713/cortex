import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/** Returns the path relative to home for display purposes. */
export function displayPath(p: string): string {
  const home = os.homedir();
  return p.startsWith(home) ? "~" + p.slice(home.length).replace(/\\/g, "/") : p;
}

/** Resolves path prefixes: ~ (home), @alias (deps) */
export function expandPath(raw: string, depsDir: string): string {
  if (raw.startsWith("~")) {
    return path.normalize(path.join(os.homedir(), raw.slice(1)));
  }

  if (raw.startsWith("@")) {
    const withoutAt = raw.slice(1);
    const slashIdx = withoutAt.indexOf("/");
    if (slashIdx === -1) return path.normalize(path.join(depsDir, withoutAt));
    const alias = withoutAt.slice(0, slashIdx);
    const rest = withoutAt.slice(slashIdx + 1);
    return path.normalize(path.join(depsDir, alias, rest));
  }

  return path.normalize(raw);
}

/** Resolves a pattern into absolute paths. Returns .md files and directories. */
export async function resolveGlob(pattern: string): Promise<string[]> {
  const normalized = pattern.replace(/\\/g, "/");
  const hasWildcard = normalized.includes("*");

  if (!hasWildcard) {
    const resolved = path.resolve(normalized);
    try {
      await fs.access(resolved);
      return [resolved];
    } catch {
      return [];
    }
  }

  const results: string[] = [];
  for await (const entry of fs.glob(normalized)) {
    const resolved = path.resolve(entry);
    const stat = await fs.stat(resolved);
    if (stat.isDirectory() || entry.endsWith(".md")) {
      results.push(resolved);
    }
  }
  return results;
}

/** Creates a directory and all missing ancestors. */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/** Returns true if the given directory contains a .git folder. */
export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, ".git"));
    return true;
  } catch {
    return false;
  }
}

/** Copies a file atomically. Returns the file contents for hashing. */
export async function copyFileAtomic(src: string, dest: string): Promise<Buffer> {
  await ensureDir(path.dirname(dest));
  const data = await fs.readFile(src);
  const tmp = dest + ".tmp";
  try {
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, dest);
  } catch (err) {
    await fs.unlink(tmp).catch(() => {});
    throw err;
  }
  return data;
}

/** Removes a file, ignoring errors if it doesn't exist. */
export async function removeFile(filePath: string): Promise<void> {
  await fs.unlink(filePath).catch(() => {});
}

/**
 * Removes empty directories bottom-up, stopping at `root` (exclusive).
 * Call after removing files to leave no empty folders behind.
 */
export async function removeEmptyDirs(dir: string, root: string): Promise<void> {
  const normDir = dir.replace(/\\/g, "/");
  const normRoot = root.replace(/\\/g, "/");
  if (normDir === normRoot || !normDir.startsWith(normRoot)) return;
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return;
  }
  if (entries.length === 0) {
    await fs.rmdir(dir).catch(() => {});
    await removeEmptyDirs(path.dirname(dir), root);
  }
}

/** Returns true if the file exists on disk. */
export async function fileExists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(() => true).catch(() => false);
}

/** Returns all .md files inside a directory (recursive). */
export async function listMdFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => path.join(e.parentPath, e.name));
  } catch {
    return [];
  }
}
