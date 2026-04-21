import fs from "node:fs/promises";
import path from "node:path";
import { expandPath, resolveGlob, listMdFiles } from "../utils/fs-utils.ts";
import { readConfig } from "./parser.ts";
import { log } from "../utils/log.ts";
import { DEPS_DIR } from "./constants.ts";

export interface ResolvedEntry {
  source: string;
  fileName: string;
}

/** Expands glob patterns into resolved file entries. Warns on non-wildcard paths that match nothing. */
export async function resolveEntries(patterns: string[]): Promise<ResolvedEntry[]> {
  const batches = await Promise.all(patterns.map(async (raw) => {
    const expanded = expandPath(raw, DEPS_DIR);
    const hasWildcard = expanded.includes("*");
    log.verbose(`glob: ${raw}  →  ${expanded}`);
    const files = await resolveGlob(expanded);
    if (!hasWildcard && files.length === 0) {
      log.warn(`Path not found: ${raw}`);
    }
    log.verbose(`  matched ${files.length} file(s)`);
    return files.map((source) => ({ source, fileName: path.basename(source) }));
  }));
  return batches.flat();
}

/** Deduplicates entries by fileName, keeping the last occurrence and warning on conflicts. */
export function deduplicateEntries(entries: ResolvedEntry[]): ResolvedEntry[] {
  const seen = new Map<string, ResolvedEntry>();
  for (const entry of entries) {
    if (seen.has(entry.fileName)) {
      log.warn(`    ⚠ Duplicate: ${entry.fileName} — overwriting with ${entry.source}`);
    }
    seen.set(entry.fileName, entry);
  }
  return [...seen.values()];
}

/** Returns the ordered list of sections (skills, agents) derived from the config. */
export function getSections(config: { skills: { paths: string[] }; agents: { paths: string[] } }) {
  return [
    { name: "skills", paths: config.skills.paths },
    { name: "agents", paths: config.agents.paths },
  ] as const;
}

/** Expands directory entries into individual .md file entries. */
export async function expandEntries(entries: ResolvedEntry[]): Promise<ResolvedEntry[]> {
  const result: ResolvedEntry[] = [];
  for (const entry of entries) {
    const stat = await fs.stat(entry.source).catch(() => null);
    if (stat?.isDirectory()) {
      const files = await listMdFiles(entry.source);
      const dirName = path.basename(entry.source);
      for (const file of files) {
        const rel = path.relative(entry.source, file);
        result.push({ source: file, fileName: path.join(dirName, rel) });
      }
    } else {
      result.push(entry);
    }
  }
  return result;
}

/** Reads cortex.toml or exits with a user-friendly error if it doesn't exist. */
export async function readConfigOrExit() {
  try {
    return await readConfig();
  } catch {
    log.error("✗ No cortex.toml found. Run 'cortex init' first.");
    process.exit(1);
  }
}
