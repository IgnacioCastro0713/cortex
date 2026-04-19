import path from "node:path";
import { isGitRepo } from "../utils/fs-utils.ts";
import { gitPull, gitCloneOrPull } from "../utils/git-utils.ts";
import { log } from "../utils/log.ts";
import { spinner } from "../utils/spinner.ts";
import { AI_DIR, DEPS_DIR } from "../core/constants.ts";
import { readConfigOrExit } from "../core/resolver.ts";

export async function update(): Promise<void> {
  log.header("update");

  const config = await readConfigOrExit();

  if (await isGitRepo(AI_DIR)) {
    log.info(`Pulling ${AI_DIR}...`);
    const out = await gitPull(AI_DIR);
    log.dim(out?.trim() || "Already up to date.");
  }

  const aliases = Object.entries(config.deps);

  if (aliases.length === 0) {
    log.dim("No dependencies defined in [deps].");
  }

  for (const [alias, url] of aliases) {
    const s = spinner(alias);
    try {
      await gitCloneOrPull(url as string, path.join(DEPS_DIR, alias));
      s.succeed();
    } catch (err) {
      s.fail(`${alias}  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  log.outro("Update complete.");
}
