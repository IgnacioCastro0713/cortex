import path from "node:path";
import { readConfig, writeConfig, defaultConfig, getConfigPath } from "../core/parser.ts";
import { ensureDir, displayPath } from "../utils/fs-utils.ts";
import { log } from "../utils/log.ts";
import { AI_DIR, DEPS_DIR } from "../core/constants.ts";

export async function init(): Promise<void> {
  log.header("init");

  await ensureDir(path.join(AI_DIR, "agents"));
  await ensureDir(path.join(AI_DIR, "skills"));
  await ensureDir(DEPS_DIR);
  log.success(displayPath(path.join(AI_DIR, "agents")));
  log.success(displayPath(path.join(AI_DIR, "skills")));
  log.success(displayPath(DEPS_DIR));

  const configPath = getConfigPath();
  try {
    await readConfig();
    log.skip(`${displayPath(configPath)}  (already exists)`);
  } catch {
    await writeConfig(defaultConfig());
    log.success(displayPath(configPath));
  }

  log.outro("Cortex initialized. Edit ~/.cortex/cortex.toml to configure your knowledge sources.");
}
