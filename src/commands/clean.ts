import path from "node:path";
import readline from "node:readline";
import { styleText } from "node:util";
import { removeFile, removeEmptyDirs, displayPath } from "../utils/fs-utils.ts";
import { log } from "../utils/log.ts";
import { getPlatform, PLATFORMS } from "../core/constants.ts";
import type { Platform } from "../core/constants.ts";
import { getSections, readConfigOrExit } from "../core/resolver.ts";
import { loadHashDB, saveHashDB, normalizeKey } from "../core/hash-db.ts";
import type { HashDB } from "../core/hash-db.ts";
import { cleanMCP } from "../core/mcp.ts";

export interface CleanOptions {
  force?: boolean;
}

/** Prompts the user for confirmation. Returns false immediately on non-interactive terminals. */
async function confirm(msg: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    log.error("Non-interactive terminal. Use --force to skip confirmation.");
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`  ${msg} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

/** Counts hash DB entries that belong to the given platforms, used to build the confirmation message. */
function countManagedFiles(platforms: Platform[], sections: ReturnType<typeof getSections>, hashDB: HashDB): number {
  let count = 0;
  for (const platform of platforms) {
    for (const section of sections) {
      const prefix = normalizeKey(path.join(platform.targetDir, section.name)) + "/";
      for (const destPath of Object.keys(hashDB)) {
        if (destPath.startsWith(prefix)) count++;
      }
    }
  }
  return count;
}

/** Deletes all hash DB-tracked files for a platform and removes their entries. Returns the count removed. */
async function removeFilesForPlatform(platform: Platform, sections: ReturnType<typeof getSections>, hashDB: HashDB): Promise<number> {
  let total = 0;
  for (const section of sections) {
    const targetDirPath = path.join(platform.targetDir, section.name);
    const prefix = normalizeKey(targetDirPath) + "/";
    const removed: string[] = [];

    for (const destPath of Object.keys(hashDB)) {
      if (destPath.startsWith(prefix)) {
        await removeFile(destPath);
        await removeEmptyDirs(path.dirname(destPath), targetDirPath);
        delete hashDB[destPath];
        removed.push(destPath);
      }
    }

    if (removed.length > 0) {
      log.success(`Removed ${removed.length} file(s) from ${displayPath(platform.targetDir)}/${section.name}/`);
      total += removed.length;
    } else {
      log.dim(`No managed files in ${displayPath(platform.targetDir)}/${section.name}/`);
    }
  }
  return total;
}

/** Removes hash DB entries whose paths don't match any known platform, guarding against DB corruption. */
function sweepOrphanedEntries(hashDB: HashDB, sections: ReturnType<typeof getSections>): void {
  const allKnownPrefixes = new Set<string>();
  for (const platform of PLATFORMS) {
    for (const section of sections) {
      allKnownPrefixes.add(normalizeKey(path.join(platform.targetDir, section.name)) + "/");
    }
  }
  for (const destPath of Object.keys(hashDB)) {
    const isKnown = [...allKnownPrefixes].some((prefix) => destPath.startsWith(prefix));
    if (!isKnown) delete hashDB[destPath];
  }
}

/** Removes all cortex-managed files and MCP entries from platform directories. */
export async function clean(options: CleanOptions = {}): Promise<void> {
  log.header("clean");

  const config = await readConfigOrExit();
  const hashDB = await loadHashDB();
  const sections = getSections(config);

  const activePlatforms = config.platforms
    .map((n) => getPlatform(n))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  const activePlatformDirs = new Set(activePlatforms.map((p) => p.targetDir));
  const inactivePlatforms = PLATFORMS.filter((p) => !activePlatformDirs.has(p.targetDir));

  const mcpNames = Object.keys(config.mcp ?? {});

  if (!options.force) {
    const fileCount = countManagedFiles([...activePlatforms, ...inactivePlatforms], sections, hashDB);
    const filePart = fileCount > 0 ? `${fileCount} file(s)` : "";
    const mcpPart  = mcpNames.length > 0 ? `${mcpNames.length} MCP server(s)` : "";
    const what = [filePart, mcpPart].filter(Boolean).join(" and ");

    if (!what) {
      log.dim("Nothing managed by cortex to remove.");
      log.outro("Nothing to clean.");
      return;
    }

    const ok = await confirm(`Remove ${what} from ${activePlatforms.length} platform(s)?`);
    if (!ok) {
      log.outro("Aborted.");
      return;
    }
  }

  let total = 0;

  for (const platform of activePlatforms) {
    console.log(`${styleText("cyan", "●")}  ${platform.name}  ${styleText("dim", `(${displayPath(platform.targetDir)}/)`)}`);
    total += await removeFilesForPlatform(platform, sections, hashDB);
  }

  for (const platform of inactivePlatforms) {
    const removed = await removeFilesForPlatform(platform, sections, hashDB);
    if (removed > 0) {
      console.log(`${styleText("cyan", "●")}  ${platform.name}  ${styleText("dim", `(${displayPath(platform.targetDir)}/)`)}`);
      log.success(`Removed ${removed} file(s) (platform removed from config)`);
      total += removed;
    }
  }

  if (mcpNames.length > 0) {
    console.log();
    const mcpResults = await cleanMCP(mcpNames, activePlatforms);
    for (const result of mcpResults) {
      if (result.ok) {
        log.success(`Removed MCP entries from ${displayPath(result.configPath)}`);
      } else {
        log.error(`Failed to clean MCP from ${displayPath(result.configPath)}: ${result.error}`);
      }
    }
  }

  sweepOrphanedEntries(hashDB, sections);
  await saveHashDB(hashDB);

  console.log();
  log.success(`Cleaned ${total} file(s) total.`);
}
