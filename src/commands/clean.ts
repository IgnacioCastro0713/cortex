import path from "node:path";
import { cleanSymlinks } from "../fs-utils.ts";
import { log } from "../log.ts";
import { PLATFORM_TARGETS } from "../constants.ts";
import { getSections, readConfigOrExit } from "../resolver.ts";

export async function clean(cwd: string): Promise<void> {
  log.plain("🧹 Cleaning symlinks from project...\n");

  const config = await readConfigOrExit();
  let total = 0;

  for (const platform of config.platforms) {
    const targetBase = PLATFORM_TARGETS[platform];
    if (!targetBase) continue;

    log.plain(`  Platform: ${platform} (${targetBase}/)`);

    for (const section of getSections(config)) {
      const targetDir = path.join(cwd, targetBase, section.name);
      const removed = await cleanSymlinks(targetDir);
      if (removed > 0) {
        log.success(`    ✓ Removed ${removed} link(s) from ${targetBase}/${section.name}/`);
        total += removed;
      } else {
        log.dim(`    ℹ No links in ${targetBase}/${section.name}/`);
      }
    }
  }

  log.plain(`\n✅ Cleaned ${total} link(s) total.`);
}
