import path from "node:path";
import { isGitRepo } from "../fs-utils.ts";
import { gitPull, gitCloneOrPull } from "../git-utils.ts";
import { log } from "../log.ts";
import { AI_DIR, DEPS_DIR } from "../constants.ts";
import { readConfigOrExit } from "../resolver.ts";

export async function update(): Promise<void> {
  log.header("update");

  const config = await readConfigOrExit();

  if (await isGitRepo(AI_DIR)) {
    log.info(`  ↻ Pulling ${AI_DIR}...`);
    const out = await gitPull(AI_DIR);
    log.dim(`    ${out || "Already up to date."}`);
  } else {
    log.dim(`  ℹ ${AI_DIR} is not a git repo — skipping pull.`);
  }

  const aliases = Object.entries(config.deps);

  if (aliases.length === 0) {
    log.dim("  ℹ No dependencies defined in [deps].");
  }

  for (const [alias, url] of aliases) {
    log.info(`  ↻ ${alias} → ${url}`);
    const out = await gitCloneOrPull(url, path.join(DEPS_DIR, alias));
    log.dim(`    ${out || "Done."}`);
  }

  log.separator();
  log.success("  ✓ Update complete.");
}
