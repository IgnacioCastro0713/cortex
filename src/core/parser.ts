import fs from "node:fs/promises";
import path from "node:path";
import { parse, stringify } from "smol-toml";
import { CORTEX_DIR } from "./constants.ts";

export interface McpServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface CortexConfig {
  platforms: string[];
  deps: Record<string, string>;
  skills: { paths: string[] };
  agents: { paths: string[] };
  mcp: Record<string, McpServer>;
}

const CONFIG_PATH = path.join(CORTEX_DIR, "cortex.toml");

/**
 * Read and parse ~/cortex.toml. Throws if the file doesn't exist.
 */
export async function readConfig(): Promise<CortexConfig> {
  const raw = await fs.readFile(CONFIG_PATH, "utf-8");
  const data = parse(raw) as Record<string, unknown>;

  return {
    platforms: (data.platforms as string[]) ?? [],
    deps: (data.deps as Record<string, string>) ?? {},
    skills: (data.skills as { paths: string[] }) ?? { paths: [] },
    agents: (data.agents as { paths: string[] }) ?? { paths: [] },
    mcp: (data.mcp as Record<string, McpServer>) ?? {},
  };
}

/**
 * Write a CortexConfig to ~/cortex.toml.
 */
export async function writeConfig(config: CortexConfig): Promise<void> {
  const content = stringify(config as unknown as Record<string, unknown>);
  await fs.writeFile(CONFIG_PATH, content, "utf-8");
}

/**
 * Generate a default cortex.toml configuration.
 */
export function defaultConfig(): CortexConfig {
  return {
    platforms: ["copilot"],
    deps: {},
    skills: { paths: ["~/.cortex/ai/skills/*"] },
    agents: { paths: ["~/.cortex/ai/agents/*"] },
    mcp: {},
  };
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}
