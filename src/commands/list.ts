import fs from "node:fs/promises";
import path from "node:path";
import { log } from "../log.ts";
import { PLATFORM_TARGETS } from "../constants.ts";
import { resolveEntries, getSections, readConfigOrExit } from "../resolver.ts";

export async function list(cwd: string): Promise<void> {
  log.plain("📋 Linked knowledge map:\n");

  const config = await readConfigOrExit();
  let total = 0;

  for (const platform of config.platforms) {
    const targetBase = PLATFORM_TARGETS[platform];
    if (!targetBase) continue;

    log.plain(`  Platform: ${platform} (${targetBase}/)`);

    for (const section of getSections(config)) {
      log.plain(`    ${section.name}/`);

      const entries = await resolveEntries(section.paths, cwd);
      for (const { source, fileName } of entries) {
        const linkPath = path.join(cwd, targetBase, section.name, fileName);
        const relLink = path.relative(cwd, linkPath);

        let broken = false;
        try {
          await fs.access(source);
        } catch {
          broken = true;
        }

        if (broken) {
          log.warn(`      ⚠ BROKEN ${relLink} → ${source}`);
        } else {
          log.success(`      ${relLink} → ${source}`);
        }
        total++;
      }
    }
  }

  if (total === 0) {
    log.dim("  (no files resolved — run `cortex sync` after configuring cortex.toml)");
  }

  log.plain(`\n  Total: ${total} file(s).`);
}
