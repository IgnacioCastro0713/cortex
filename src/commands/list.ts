import fs from "node:fs/promises";
import path from "node:path";
import { log } from "../log.ts";
import { getPlatform } from "../constants.ts";
import { resolveEntries, getSections, readConfigOrExit } from "../resolver.ts";

export async function list(cwd: string): Promise<void> {
  log.header("list");

  const config = await readConfigOrExit();
  let total = 0;

  for (const platformName of config.platforms) {
    const platform = getPlatform(platformName);
    if (!platform) continue;
    const { name, targetDir } = platform;

    log.plain(`\n  Platform: ${name} (${targetDir}/)`);

    for (const section of getSections(config)) {
      log.dim(`    ${section.name}/`);

      const entries = await resolveEntries(section.paths, cwd);
      for (const { source, fileName } of entries) {
        const linkPath = path.join(cwd, targetDir, section.name, fileName);
        const relLink = path.relative(cwd, linkPath);

        let broken = false;
        try {
          await fs.access(source);
        } catch {
          broken = true;
        }

        if (broken) {
          log.warn(`      ⚠ ${relLink}`);
          log.warn(`        → ${source} (not found)`);
        } else {
          log.plain(`      ${relLink}`);
          log.dim(`        → ${source}`);
        }
        total++;
      }
    }
  }

  log.separator();
  if (total === 0) {
    log.dim("  No files resolved — run `cortex sync` after configuring cortex.toml.");
  } else {
    log.plain(`  ${total} file(s) linked.`);
  }
}
