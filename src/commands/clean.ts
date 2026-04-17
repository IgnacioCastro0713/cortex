import path from "node:path";
import { cleanSymlinks } from "../fs-utils.ts";
import { log } from "../log.ts";
import { getPlatform } from "../constants.ts";
import { getSections, readConfigOrExit } from "../resolver.ts";

export async function clean(cwd: string): Promise<void> {
  log.header("clean");

  const config = await readConfigOrExit();
  let total = 0;

  for (const platformName of config.platforms) {
    const platform = getPlatform(platformName);
    if (!platform) continue;
    const { name, targetDir } = platform;

    log.plain(`\n  Platform: ${name} (${targetDir}/)`);

    for (const section of getSections(config)) {
      const targetDirPath = path.join(cwd, targetDir, section.name);
      const removed = await cleanSymlinks(targetDirPath);
      if (removed > 0) {
        log.success(`    ✓ Removed ${removed} link(s) from ${targetDir}/${section.name}/`);
        total += removed;
      } else {
        log.dim(`    ℹ No links in ${targetDir}/${section.name}/`);
      }
    }
  }

  log.separator();
  log.success(`  ✓ Cleaned ${total} link(s) total.`);
}
