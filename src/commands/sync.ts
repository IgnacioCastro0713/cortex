import path from "node:path";
import fs from "node:fs/promises";
import { styleText } from "node:util";
import { copyFileAtomic, removeFile, removeEmptyDirs, listMdFiles, fileExists } from "../utils/fs-utils.ts";
import { loadHashDB, saveHashDB, md5, isDirty, normalizeKey, type HashDB } from "../core/hash-db.ts";
import { log } from "../utils/log.ts";
import { getPlatform } from "../core/constants.ts";
import type { Platform } from "../core/constants.ts";
import { resolveEntries, deduplicateEntries, getSections, readConfigOrExit } from "../core/resolver.ts";
import type { ResolvedEntry } from "../core/resolver.ts";
import { renderTree } from "../utils/tree.ts";
import { syncMCP, displayPath } from "../core/mcp.ts";
import type { McpServer } from "../core/parser.ts";

export interface SyncOptions {
  dryRun?: boolean;
  force?: boolean;
}

interface SyncResult {
  copied: number;
  skipped: number;
  failed: number;
}

/** Expands directory entries into individual .md file entries. */
async function expandEntries(entries: ResolvedEntry[]): Promise<ResolvedEntry[]> {
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

/** Removes files from the target directory that are no longer in the resolved entries. */
async function removeStaleFiles(entries: ResolvedEntry[], targetDirPath: string, hashDB: HashDB): Promise<void> {
  const expectedDests = new Set(entries.map(({ fileName }) => normalizeKey(path.join(targetDirPath, fileName))));
  for (const destPath of Object.keys(hashDB)) {
    if (destPath.startsWith(normalizeKey(targetDirPath) + "/") && !expectedDests.has(destPath)) {
      await removeFile(destPath);
      await removeEmptyDirs(path.dirname(destPath), targetDirPath);
      delete hashDB[destPath];
      const rel = path.relative(targetDirPath, destPath).replace(/\\/g, "/");
      log.warn(`🗑  ${rel}  (stale, removed)`);
    }
  }
}

interface TaggedEntry {
  path: string;
  reason: string;
}

interface CopyResult {
  copied: string[];
  skipped: TaggedEntry[];
  failed: TaggedEntry[];
}

/** Copies resolved entries to the target directory, skipping dirty or unmanaged files unless forced. */
async function copyEntries(entries: ResolvedEntry[], targetDirPath: string, hashDB: HashDB, force: boolean): Promise<CopyResult> {
  const copied: string[] = [];
  const skipped: TaggedEntry[] = [];
  const failed: TaggedEntry[] = [];

  for (const { source, fileName } of entries) {
    const destPath = path.join(targetDirPath, fileName);
    const relDest = fileName.replace(/\\/g, "/");
    try {
      const isManaged = normalizeKey(destPath) in hashDB;
      const destExists = await fileExists(destPath);

      if (!force && destExists && !isManaged) {
        skipped.push({ path: relDest, reason: "unmanaged" });
        continue;
      }
      if (!force && await isDirty(hashDB, destPath)) {
        skipped.push({ path: relDest, reason: "locally modified" });
        continue;
      }
      const data = await copyFileAtomic(source, destPath);
      hashDB[normalizeKey(destPath)] = md5(data);
      copied.push(relDest);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ path: relDest, reason: msg });
    }
  }

  return { copied, skipped, failed };
}

/** Renders a colored tree of copied, skipped, and failed files for a section. */
function renderSectionResult(sectionName: string, { copied, skipped, failed }: CopyResult): void {
  const allCount = copied.length + skipped.length + failed.length;

  if (allCount === 0) {
    log.dim(`${sectionName} — nothing to sync`);
    return;
  }

  const parts: string[] = [`${copied.length} files`];
  if (skipped.length) parts.push(`${skipped.length} skipped`);
  if (failed.length) parts.push(`${failed.length} failed`);

  const treeEntries = [
    ...copied,
    ...skipped.map(({ path: p, reason }) => p.replace(/([^/]+)$/, `⚠ $1 (${reason})`)),
    ...failed.map(({ path: p, reason })  => p.replace(/([^/]+)$/, `✗ $1 (${reason})`)),
  ];

  log.success(`${sectionName}/  (${parts.join(", ")})`);
  const I = "  ";
  for (const line of renderTree(sectionName, treeEntries).split("\n")) {
    if (line.includes("⚠ ")) {
      console.log(`${I}${styleText("yellow", line)}`);
    } else if (line.includes("✗ ")) {
      console.log(`${I}${styleText("red", line)}`);
    } else {
      console.log(`${I}${styleText("dim", line)}`);
    }
  }
}

interface SyncSectionOptions {
  section: { name: string; paths: string[] };
  targetDirPath: string;
  hashDB: HashDB;
  dryRun: boolean;
  force: boolean;
}

/** Resolves, deduplicates, and syncs a single section (skills or agents) to a platform directory. */
async function syncSection({ section, targetDirPath, hashDB, dryRun, force }: SyncSectionOptions): Promise<SyncResult> {
  const raw = await resolveEntries(section.paths);
  const entries = deduplicateEntries(await expandEntries(raw));

  if (!dryRun) await removeStaleFiles(entries, targetDirPath, hashDB);

  if (entries.length === 0) {
    log.dim(`${section.name} — nothing to sync`);
    return { copied: 0, skipped: 0, failed: 0 };
  }

  if (dryRun) {
    log.info(`${section.name} (dry-run)`);
    log.dim(renderTree(section.name, entries.map(({ fileName }) => fileName.replace(/\\/g, "/"))));
    return { copied: 0, skipped: 0, failed: 0 };
  }

  const result = await copyEntries(entries, targetDirPath, hashDB, force);
  renderSectionResult(section.name, result);
  return { copied: result.copied.length, skipped: result.skipped.length, failed: result.failed.length };
}

/** Maps platform names from config to Platform objects, warning on unknown names. */
function resolveActivePlatforms(platformNames: string[]): Platform[] {
  const platforms: Platform[] = [];
  for (const name of platformNames) {
    const platform = getPlatform(name);
    if (!platform) {
      log.warn(`Unknown platform "${name}" — skipping.`);
      continue;
    }
    platforms.push(platform);
  }
  return platforms;
}

/** Syncs MCP server configs into each platform's config file and prints results. */
async function renderMcpResults(mcp: Record<string, McpServer>, platforms: Platform[], dryRun: boolean): Promise<void> {
  const serverNames = Object.keys(mcp);

  if (dryRun) {
    console.log(`${styleText("cyan", "●")}  mcp  ${styleText("dim", "(dry-run)")}`);
    console.log();
    for (const platform of platforms) {
      log.dim(`  ${displayPath(platform.mcpConfigPath)}  — ${serverNames.join(", ")}`);
    }
    console.log();
    return;
  }

  const results = await syncMCP(mcp, platforms, false);
  console.log(`${styleText("cyan", "●")}  mcp`);
  console.log();
  for (const result of results) {
    const pathDisplay = styleText("dim", displayPath(result.configPath));
    if (result.ok) {
      console.log(`  ${styleText("green", "✓")}  ${serverNames.join(", ")}  ${pathDisplay}`);
    } else {
      console.log(`  ${styleText("red", "✗")}  ${result.platform}  ${pathDisplay}  — ${result.error}`);
    }
  }
  console.log();
}

/** Prints the final sync summary with counts of copied, skipped, and failed files. */
function renderSyncSummary(totals: SyncResult, dryRun: boolean): void {
  console.log();
  if (dryRun) {
    log.outro("Preview complete.");
  } else {
    const parts: string[] = [`${totals.copied} file(s) copied`];
    if (totals.skipped) parts.push(styleText("yellow", `${totals.skipped} skipped`));
    if (totals.failed)  parts.push(styleText("red",    `${totals.failed} failed`));
    log.success(`Sync complete — ${parts.join(", ")}.`);
  }
}

/** Main sync command — copies knowledge files and MCP configs into global platform directories. */
export async function sync(options: SyncOptions = {}): Promise<void> {
  log.header("sync");

  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;

  if (dryRun) log.warn("dry-run — no changes will be made");

  const config = await readConfigOrExit();
  const activePlatforms = resolveActivePlatforms(config.platforms);

  if (activePlatforms.length === 0) {
    log.warn("No platforms configured. Add platforms in cortex.toml.");
    log.outro("Aborted.");
    return;
  }

  const hashDB = await loadHashDB();
  const totals: SyncResult = { copied: 0, skipped: 0, failed: 0 };

  try {
    for (const platform of activePlatforms) {
      console.log(`${styleText("cyan", "●")}  ${platform.name}  ${styleText("dim", `(${displayPath(platform.targetDir)}/)`)}`);
      console.log();

      for (const section of getSections(config)) {
        const targetDirPath = path.join(platform.targetDir, section.name);
        const result = await syncSection({ section, targetDirPath, hashDB, dryRun, force });
        console.log();
        totals.copied  += result.copied;
        totals.skipped += result.skipped;
        totals.failed  += result.failed;
      }
    }
  } finally {
    if (!dryRun) await saveHashDB(hashDB);
  }

  const mcpEntries = Object.entries(config.mcp ?? {});
  if (mcpEntries.length > 0) {
    await renderMcpResults(config.mcp, activePlatforms, dryRun);
  }

  renderSyncSummary(totals, dryRun);
}
