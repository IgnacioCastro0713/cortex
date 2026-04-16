import path from "node:path";
import { readConfig, writeConfig, defaultConfig, getConfigPath } from "../parser.ts";
import { ensureDir } from "../fs-utils.ts";
import { log } from "../log.ts";
import { CORTEX_DIR, AI_DIR, DEPS_DIR } from "../constants.ts";

export async function init(): Promise<void> {
  log.plain("⚡ Initializing Cortex...\n");

  await ensureDir(path.join(AI_DIR, "agents"));
  await ensureDir(path.join(AI_DIR, "skills"));
  await ensureDir(DEPS_DIR);
  log.success(`  ✓ Created ${CORTEX_DIR}/ai/agents`);
  log.success(`  ✓ Created ${CORTEX_DIR}/ai/skills`);

  const configPath = getConfigPath();
  try {
    await readConfig();
    log.info(`  ✓ ${configPath} already exists — skipping.`);
  } catch {
    await writeConfig(defaultConfig());
    log.success(`  ✓ Generated ${configPath}`);
  }

  log.plain("\n✅ Cortex initialized. Edit ~/.cortex/cortex.toml to configure your knowledge sources.");
}
