import path from "node:path";
import os from "node:os";
import { readConfig, writeConfig, defaultConfig, getConfigPath } from "../core/parser.ts";
import { ensureDir } from "../utils/fs-utils.ts";
import { log } from "../utils/log.ts";
import { AI_DIR, DEPS_DIR } from "../core/constants.ts";

function tildePath(p: string): string {
  const home = os.homedir();
  return p.startsWith(home) ? `~${p.slice(home.length).replace(/\\/g, "/")}` : p;
}

export async function init(): Promise<void> {
  log.header("init");

  await ensureDir(path.join(AI_DIR, "agents"));
  await ensureDir(path.join(AI_DIR, "skills"));
  await ensureDir(DEPS_DIR);
  log.success(tildePath(path.join(AI_DIR, "agents")));
  log.success(tildePath(path.join(AI_DIR, "skills")));
  log.success(tildePath(DEPS_DIR));

  const configPath = getConfigPath();
  try {
    await readConfig();
    log.skip(`${tildePath(configPath)}  (already exists)`);
  } catch {
    await writeConfig(defaultConfig());
    log.success(tildePath(configPath));
  }

  log.outro("Cortex initialized. Edit ~/.cortex/cortex.toml to configure your knowledge sources.");
}
