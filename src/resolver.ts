import path from "node:path";
import { expandPath, resolveGlob } from "./fs-utils.ts";
import { readConfig } from "./parser.ts";
import { log } from "./log.ts";
import { DEPS_DIR } from "./constants.ts";

export interface ResolvedEntry {
  source: string;
  fileName: string;
}

export async function resolveEntries(patterns: string[], cwd: string): Promise<ResolvedEntry[]> {
  const entries: ResolvedEntry[] = [];
  for (const raw of patterns) {
    const expanded = expandPath(raw, DEPS_DIR, cwd);
    const files = await resolveGlob(expanded);
    for (const source of files) {
      entries.push({ source, fileName: path.basename(source) });
    }
  }
  return entries;
}

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

export function getSections(config: { skills: { paths: string[] }; agents: { paths: string[] } }) {
  return [
    { name: "skills", paths: config.skills.paths },
    { name: "agents", paths: config.agents.paths },
  ] as const;
}

export async function readConfigOrExit() {
  try {
    return await readConfig();
  } catch {
    log.error("✗ No cortex.toml found. Run 'cortex init' first.");
    process.exit(1);
  }
}
