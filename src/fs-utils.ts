import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/** Resolves path prefixes: ~ (home), @alias (deps), ./ (cwd) */
export function expandPath(raw: string, depsDir: string, cwd: string): string {
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

  if (raw.startsWith("./") || raw.startsWith(".\\")) {
    return path.normalize(path.join(cwd, raw));
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

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/** Creates a symlink. Requires Developer Mode on Windows. */
export async function createSymlink(target: string, linkPath: string): Promise<void> {
  await ensureDir(path.dirname(linkPath));

  try {
    await fs.unlink(linkPath);
  } catch {
    // doesn't exist yet
  }

  await fs.symlink(target, linkPath);
}

/** Removes symlinks and junctions inside a directory. */
export async function cleanSymlinks(dir: string): Promise<number> {
  let removed = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        await fs.rm(path.join(dir, entry.name), { recursive: true });
        removed++;
      }
    }
  } catch {
    // directory doesn't exist yet
  }
  return removed;
}

export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, ".git"));
    return true;
  } catch {
    return false;
  }
}
