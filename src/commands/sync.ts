import path from "node:path";
import { createSymlink, cleanSymlinks } from "../fs-utils.ts";
import { log } from "../log.ts";
import { PLATFORM_TARGETS } from "../constants.ts";
import { resolveEntries, deduplicateEntries, getSections, readConfigOrExit } from "../resolver.ts";

export interface SyncOptions {
  dryRun?: boolean;
}

export async function sync(cwd: string, options: SyncOptions = {}): Promise<void> {
  const prefix = options.dryRun ? "[dry-run] " : "";
  log.plain(`${prefix}🔗 Syncing knowledge into project...\n`);

  const config = await readConfigOrExit();

  if (config.platforms.length === 0) {
    log.warn("  ⚠ No platforms configured. Add platforms in cortex.toml.");
    return;
  }

  for (const platform of config.platforms) {
    const targetBase = PLATFORM_TARGETS[platform];
    if (!targetBase) {
      log.warn(`  ⚠ Unknown platform "${platform}" — skipping.`);
      continue;
    }

    log.plain(`  Platform: ${platform} → ${targetBase}/`);

    for (const section of getSections(config)) {
      const targetDir = path.join(cwd, targetBase, section.name);

      if (!options.dryRun) {
        const removed = await cleanSymlinks(targetDir);
        if (removed > 0) {
          log.dim(`    🗑  Cleaned ${removed} old link(s) in ${targetBase}/${section.name}/`);
        }
      }

      const raw = await resolveEntries(section.paths, cwd);
      const entries = deduplicateEntries(raw);

      if (entries.length === 0) {
        log.dim(`    ℹ No ${section.name} resolved.`);
        continue;
      }

      for (const { source, fileName } of entries) {
        const linkPath = path.join(targetDir, fileName);
        const relLink = path.relative(cwd, linkPath);

        if (options.dryRun) {
          log.info(`    ${prefix}${relLink} → ${source}`);
          continue;
        }

        try {
          await createSymlink(source, linkPath);
          log.success(`    ✓ ${relLink} → ${source}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          log.error(`    ✗ Failed: ${fileName} — ${msg}`);
        }
      }
    }
  }

  log.plain(`\n${prefix}✅ Sync complete.`);
}
