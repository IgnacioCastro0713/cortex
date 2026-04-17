import path from "node:path";
import { createSymlink, cleanSymlinks } from "../fs-utils.ts";
import { log } from "../log.ts";
import { getPlatform } from "../constants.ts";
import { resolveEntries, deduplicateEntries, getSections, readConfigOrExit } from "../resolver.ts";

export interface SyncOptions {
  dryRun?: boolean;
}

export async function sync(cwd: string, options: SyncOptions = {}): Promise<void> {
  log.header("sync");

  if (options.dryRun) {
    log.warn("  dry-run — no changes will be made\n");
  }

  const config = await readConfigOrExit();

  if (config.platforms.length === 0) {
    log.warn("  ⚠ No platforms configured. Add platforms in cortex.toml.");
    return;
  }

  let total = 0;

  for (const platformName of config.platforms) {
    const platform = getPlatform(platformName);
    if (!platform) {
      log.warn(`  ⚠ Unknown platform "${platformName}" — skipping.`);
      continue;
    }
    const { name, targetDir } = platform;

    log.plain(`\n  Platform: ${name} (${targetDir}/)`);

    for (const section of getSections(config)) {
      const targetDirPath = path.join(cwd, targetDir, section.name);

      if (!options.dryRun) {
        const removed = await cleanSymlinks(targetDirPath);
        if (removed > 0) {
          log.dim(`    🗑  Cleaned ${removed} old link(s) in ${targetDir}/${section.name}/`);
        }
      }

      const raw = await resolveEntries(section.paths, cwd);
      const entries = deduplicateEntries(raw);

      if (entries.length === 0) {
        log.dim(`    ℹ No ${section.name} resolved.`);
        continue;
      }

      for (const { source, fileName } of entries) {
        const linkPath = path.join(targetDirPath, fileName);
        const relLink = path.relative(cwd, linkPath);

        if (options.dryRun) {
          log.info(`    → ${relLink}`);
          log.dim(`      ${source}`);
          continue;
        }

        try {
          await createSymlink(source, linkPath);
          log.success(`    ✓ ${relLink}`);
          total++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          log.error(`    ✗ ${fileName} — ${msg}`);
        }
      }
    }
  }

  log.separator();
  if (options.dryRun) {
    log.dim("  Preview complete.");
  } else {
    log.success(`  ✓ Sync complete  (${total} link(s))`);
  }
}
