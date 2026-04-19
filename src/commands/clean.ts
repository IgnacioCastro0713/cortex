import path from "node:path";
import readline from "node:readline";
import { styleText } from "node:util";
import { removeFile, removeEmptyDirs, displayPath } from "../utils/fs-utils.ts";
import { log } from "../utils/log.ts";
import { getPlatform, PLATFORMS } from "../core/constants.ts";
import { getSections, readConfigOrExit } from "../core/resolver.ts";
import { loadHashDB, saveHashDB, normalizeKey } from "../core/hash-db.ts";
import { cleanMCP } from "../core/mcp.ts";

export interface CleanOptions {
  force?: boolean;
}

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

export async function clean(options: CleanOptions = {}): Promise<void> {
  log.header("clean");

  const config = await readConfigOrExit();
  const hashDB = await loadHashDB();

  // Count files that would be removed across active platforms
  const activePlatforms = config.platforms
    .map((n) => getPlatform(n))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  let fileCount = 0;
  for (const platform of activePlatforms) {
    for (const section of getSections(config)) {
      const targetDirPath = path.join(platform.targetDir, section.name);
      for (const destPath of Object.keys(hashDB)) {
        if (destPath.startsWith(normalizeKey(targetDirPath) + "/")) fileCount++;
      }
    }
  }

  const mcpNames = Object.keys(config.mcp ?? {});
  const platformCount = activePlatforms.length;

  if (!options.force) {
    const filePart = fileCount > 0 ? `${fileCount} file(s)` : "";
    const mcpPart  = mcpNames.length > 0 ? `${mcpNames.length} MCP server(s)` : "";
    const what = [filePart, mcpPart].filter(Boolean).join(" and ");

    if (!what) {
      log.dim("Nothing managed by cortex to remove.");
      log.outro("Nothing to clean.");
      return;
    }

    const ok = await confirm(
      `Remove ${what} from ${platformCount} platform(s)?`,
    );
    if (!ok) {
      log.outro("Aborted.");
      return;
    }
  }

  let total = 0;

  // Remove knowledge files (skills/agents)
  for (const platform of activePlatforms) {
    const { name, targetDir } = platform;

    console.log(`${styleText("cyan", "●")}  ${name}  ${styleText("dim", `(${displayPath(targetDir)}/)`)}`);

    for (const section of getSections(config)) {
      const targetDirPath = path.join(targetDir, section.name);
      const removed: string[] = [];

      for (const destPath of Object.keys(hashDB)) {
        if (destPath.startsWith(normalizeKey(targetDirPath) + "/")) {
          await removeFile(destPath);
          await removeEmptyDirs(path.dirname(destPath), targetDirPath);
          delete hashDB[destPath];
          removed.push(destPath);
        }
      }

      if (removed.length > 0) {
        log.success(`Removed ${removed.length} file(s) from ${displayPath(targetDir)}/${section.name}/`);
        total += removed.length;
      } else {
        log.dim(`No managed files in ${displayPath(targetDir)}/${section.name}/`);
      }
    }
  }

  // Remove MCP entries from platform configs
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

  // Sweep orphaned hash DB entries (platforms removed from config)
  const allKnownPrefixes = new Set<string>();
  for (const platform of PLATFORMS) {
    for (const section of getSections(config)) {
      allKnownPrefixes.add(normalizeKey(path.join(platform.targetDir, section.name)) + "/");
    }
  }
  for (const destPath of Object.keys(hashDB)) {
    const isKnown = [...allKnownPrefixes].some((prefix) => destPath.startsWith(prefix));
    if (!isKnown) {
      delete hashDB[destPath];
    }
  }

  await saveHashDB(hashDB);

  console.log();
  log.success(`Cleaned ${total} file(s) total.`);
}
