import fs from "node:fs/promises";
import { styleText } from "node:util";
import { log } from "../utils/log.ts";
import { getPlatform } from "../core/constants.ts";
import { resolveEntries, getSections, readConfigOrExit } from "../core/resolver.ts";
import { renderTree } from "../utils/tree.ts";
import { displayPath } from "../core/mcp.ts";

export async function list(): Promise<void> {
  log.header("list");

  const config = await readConfigOrExit();
  let total = 0;

  for (const platformName of config.platforms) {
    const platform = getPlatform(platformName);
    if (!platform) continue;
    const { name, targetDir } = platform;

    const sectionLines: string[] = [];

    for (const section of getSections(config)) {
      const entries = await resolveEntries(section.paths);
      if (entries.length === 0) continue;

      const fileNames: string[] = [];
      const brokenLines: string[] = [];

      for (const { source, fileName } of entries) {
        const relDest = fileName.replace(/\\/g, "/");
        let broken = false;
        try {
          await fs.access(source);
        } catch {
          broken = true;
        }

        if (broken) {
          brokenLines.push(`⚠ ${relDest} → ${source} (not found)`);
        } else {
          fileNames.push(relDest);
        }
        total++;
      }

      if (fileNames.length > 0) sectionLines.push(renderTree(section.name, fileNames));
      for (const b of brokenLines) sectionLines.push(b);
    }

    if (sectionLines.length > 0) {
      console.log(`${styleText("cyan", "●")}  ${name}  ${styleText("dim", `(${displayPath(targetDir)}/)`)}`);
      log.dim(sectionLines.join("\n\n"));
      console.log();
    }
  }

  if (total === 0) {
    console.log();
    log.outro("No files resolved — run `cortex sync` after configuring cortex.toml.");
  } else {
    console.log();
    log.success(`${total} file(s) listed.`);
  }
}
