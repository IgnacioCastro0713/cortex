import path from "node:path";
import fs from "node:fs/promises";
import { styleText } from "node:util";
import { copyFileAtomic, removeFile, listMdFiles, fileExists } from "../utils/fs-utils.ts";
import { loadHashDB, saveHashDB, md5, isDirty, normalizeKey, type HashDB } from "../core/hash-db.ts";
import { log } from "../utils/log.ts";
import { getPlatform } from "../core/constants.ts";
import { resolveEntries, deduplicateEntries, getSections, readConfigOrExit } from "../core/resolver.ts";
import type { ResolvedEntry } from "../core/resolver.ts";
import { renderTree } from "../utils/tree.ts";

export interface SyncOptions {
  dryRun?: boolean;
  force?: boolean;
}

interface SyncSectionOptions {
  section: { name: string; paths: string[] };
  targetDirPath: string;
  cwd: string;
  hashDB: HashDB;
  dryRun: boolean;
  force: boolean;
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

async function syncSection({ section, targetDirPath, cwd, hashDB, dryRun, force }: SyncSectionOptions): Promise<{ copied: number; skipped: number; failed: number }> {
  const raw = await resolveEntries(section.paths, cwd);
  const entries = deduplicateEntries(await expandEntries(raw));

  // Stale file removal
  if (!dryRun) {
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

  if (entries.length === 0) {
    log.dim(`${section.name} — nothing to sync`);
    return { copied: 0, skipped: 0, failed: 0 };
  }

  // Dry-run: render tree
  if (dryRun) {
    log.info(`${section.name} (dry-run)`);
    log.dim(renderTree(section.name, entries.map(({ fileName }) => fileName.replace(/\\/g, "/"))));
    return { copied: 0, skipped: 0, failed: 0 };
  }

  // Real sync: collect results silently, then render
  const skipped: string[] = [];  // relDest paths only
  const failed:  string[] = [];  // relDest paths only
  const copied:  string[] = [];

  for (const { source, fileName } of entries) {
    const destPath = path.join(targetDirPath, fileName);
    const relDest = fileName.replace(/\\/g, "/");
    try {
      const isManaged = normalizeKey(destPath) in hashDB;
      const destExists = await fileExists(destPath);

      if (!force && destExists && !isManaged) {
        skipped.push(relDest);
        continue;
      }
      if (!force && await isDirty(hashDB, destPath)) {
        skipped.push(relDest);
        continue;
      }
      const data = await copyFileAtomic(source, destPath);
      hashDB[normalizeKey(destPath)] = md5(data);
      copied.push(relDest);
    } catch (err: unknown) {
      failed.push(relDest);
    }
  }

  const parts: string[] = [`${copied.length} files`];
  if (skipped.length) parts.push(`${skipped.length} skipped`);
  if (failed.length) parts.push(`${failed.length} failed`);

  // Build a single tree with all files: copied normally, skipped with ⚠, failed with ✗
  const treeEntries = [
    ...copied,
    ...skipped.map((p) => p.replace(/([^/]+)$/, "⚠ $1")),
    ...failed.map((p)  => p.replace(/([^/]+)$/, "✗ $1")),
  ];

  const allCount = copied.length + skipped.length + failed.length;

  if (allCount > 0) {
    log.success(`${section.name}/  (${parts.join(", ")})`);
    const I = "  ";
    for (const line of renderTree(section.name, treeEntries).split("\n")) {
      if (line.includes("⚠ ")) {
        console.log(`${I}${styleText("yellow", line)}`);
      } else if (line.includes("✗ ")) {
        console.log(`${I}${styleText("red", line)}`);
      } else {
        console.log(`${I}${styleText("dim", line)}`);
      }
    }
  } else {
    log.dim(`${section.name} — nothing to sync`);
  }

  return { copied: copied.length, skipped: skipped.length, failed: failed.length };
}

export async function sync(cwd: string, options: SyncOptions = {}): Promise<void> {
  log.header("sync");

  if (options.dryRun) {
    log.warn("dry-run — no changes will be made");
  }

  const config = await readConfigOrExit();

  if (config.platforms.length === 0) {
    log.warn("No platforms configured. Add platforms in cortex.toml.");
    log.outro("Aborted.");
    return;
  }

  const hashDB = await loadHashDB();
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  let totalCopied = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  try {
    for (const platformName of config.platforms) {
      const platform = getPlatform(platformName);
      if (!platform) {
        log.warn(`Unknown platform "${platformName}" — skipping.`);
        continue;
      }
      const { name, targetDir } = platform;

      console.log(`${styleText("cyan", "●")}  ${name}  ${styleText("dim", `(${targetDir}/)`)}`);
      console.log();

      for (const section of getSections(config)) {
        const targetDirPath = path.join(cwd, targetDir, section.name);
        const result = await syncSection({ section, targetDirPath, cwd, hashDB, dryRun, force });
        totalCopied  += result.copied;
        totalSkipped += result.skipped;
        totalFailed  += result.failed;
      }
    }
  } finally {
    if (!dryRun) {
      await saveHashDB(hashDB);
    }
  }

  if (dryRun) {
    console.log();
    log.outro("Preview complete.");
  } else {
    const parts: string[] = [`${totalCopied} file(s) copied`];
    if (totalSkipped) parts.push(styleText("yellow", `${totalSkipped} skipped`));
    if (totalFailed)  parts.push(styleText("red",    `${totalFailed} failed`));
    console.log();
    log.success(`Sync complete — ${parts.join(", ")}.`);
  }
}
