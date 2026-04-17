import path from "node:path";
import { readConfig, writeConfig, defaultConfig, getConfigPath } from "../core/parser.ts";
import { ensureDir } from "../utils/fs-utils.ts";
import { log } from "../utils/log.ts";
import { CORTEX_DIR, AI_DIR, DEPS_DIR } from "../core/constants.ts";

export async function init(): Promise<void> {
  log.header("init");

  await ensureDir(path.join(AI_DIR, "agents"));
  await ensureDir(path.join(AI_DIR, "skills"));
  await ensureDir(DEPS_DIR);
  log.success(`${CORTEX_DIR}/ai/agents`);
  log.success(`${CORTEX_DIR}/ai/skills`);
  log.success(`${CORTEX_DIR}/deps`);

  const configPath = getConfigPath();
  try {
    await readConfig();
    log.dim(`${configPath} already exists — skipping.`);
  } catch {
    await writeConfig(defaultConfig());
    log.success(`${configPath}`);
  }

  log.outro("Cortex initialized. Edit ~/.cortex/cortex.toml to configure your knowledge sources.");
}
