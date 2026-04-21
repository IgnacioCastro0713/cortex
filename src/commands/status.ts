import fs from "node:fs/promises";
import path from "node:path";
import { styleText } from "node:util";
import { log } from "../utils/log.ts";
import { resolvePlatforms } from "../core/constants.ts";
import { resolveEntries, deduplicateEntries, expandEntries, getSections, readConfigOrExit } from "../core/resolver.ts";
import { loadHashDB, normalizeKey, md5 } from "../core/hash-db.ts";

type FileState = "synced" | "modified" | "missing" | "new";

/** Determines the most severe state for a file across all active platforms. */
async function resolveState(
  fileName: string,
  sectionName: string,
  platforms: Awaited<ReturnType<typeof resolvePlatforms>>,
  hashDB: Record<string, string>,
): Promise<FileState> {
  let state: FileState = "new";

  for (const platform of platforms) {
    const destPath = path.join(platform.targetDir, sectionName, fileName);
    const stored = hashDB[normalizeKey(destPath)];

    if (!stored) continue;

    let diskHash: string | null = null;
    try {
      diskHash = md5(await fs.readFile(destPath));
    } catch {
      // file is missing from disk
    }

    if (diskHash === null) {
      state = "missing";
    } else if (diskHash !== stored) {
      return "modified"; // worst case — return immediately
    } else if (state === "new") {
      state = "synced";
    }
  }

  return state;
}

const STATE_LABEL: Record<FileState, string> = {
  synced:   "synced  ",
  modified: "modified",
  missing:  "missing ",
  new:      "new     ",
};

function renderFileState(fileName: string, state: FileState): void {
  const name = fileName.replace(/\\/g, "/");
  const label = STATE_LABEL[state];
  const I = "  ";

  switch (state) {
    case "synced":
      console.log(`${I}  ${styleText("green",  "✓")}  ${styleText("dim", label)}  ${name}`);
      break;
    case "modified":
      console.log(`${I}  ${styleText("yellow", "⚠")}  ${styleText("yellow", label)}  ${name}  ${styleText("dim", "(locally modified, use --force to overwrite)")}`);
      break;
    case "missing":
      console.log(`${I}  ${styleText("red",    "✗")}  ${styleText("dim", label)}  ${name}  ${styleText("dim", "(was synced but removed from destination)")}`);
      break;
    case "new":
      console.log(`${I}  ${styleText("cyan",   "+")}  ${styleText("dim", label)}  ${name}  ${styleText("dim", "(not yet synced)")}`);
      break;
  }
}

/** Shows the sync state of each configured file across all active platforms. */
export async function status(): Promise<void> {
  log.header("status");

  const config = await readConfigOrExit();
  const activePlatforms = resolvePlatforms(config.platforms, config.platform, (msg) => log.warn(msg));

  if (activePlatforms.length === 0) {
    log.warn("No platforms configured. Add platforms in cortex.toml.");
    log.outro("Nothing to show.");
    return;
  }

  const hashDB = await loadHashDB();
  const counts: Record<FileState, number> = { synced: 0, modified: 0, missing: 0, new: 0 };
  let totalFiles = 0;

  for (const section of getSections(config)) {
    const raw = await resolveEntries(section.paths);
    const entries = deduplicateEntries(await expandEntries(raw));

    if (entries.length === 0) continue;

    console.log(`  ${styleText("dim", section.name)}`);

    for (const { fileName } of entries) {
      const state = await resolveState(fileName, section.name, activePlatforms, hashDB);
      renderFileState(fileName, state);
      counts[state]++;
      totalFiles++;
    }

    console.log();
  }

  if (totalFiles === 0) {
    log.outro("No files configured.");
    return;
  }

  const parts: string[] = [];
  if (counts.synced)   parts.push(styleText("green",  `${counts.synced} synced`));
  if (counts.modified) parts.push(styleText("yellow", `${counts.modified} modified`));
  if (counts.missing)  parts.push(styleText("red",    `${counts.missing} missing`));
  if (counts.new)      parts.push(styleText("cyan",   `${counts.new} new`));

  console.log(`  ${parts.join("  ·  ")}`);
  console.log();
}
