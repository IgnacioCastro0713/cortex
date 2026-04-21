import path from "node:path";
import os from "node:os";
import type { CustomPlatformDef } from "./parser.ts";

export const CORTEX_DIR = path.join(os.homedir(), ".cortex");
export const AI_DIR = path.join(CORTEX_DIR, "ai");
export const DEPS_DIR = path.join(CORTEX_DIR, "deps");

export interface Platform {
  name: string;
  targetDir: string;
  mcpConfigPath: string;
  mcpKey: string;
}

export const PLATFORMS: Platform[] = [
  { name: "copilot", targetDir: path.join(os.homedir(), ".copilot"), mcpConfigPath: path.join(os.homedir(), ".copilot", "mcp-config.json"), mcpKey: "mcpServers" },
  { name: "gemini", targetDir: path.join(os.homedir(), ".gemini"), mcpConfigPath: path.join(os.homedir(), ".gemini", "settings.json"), mcpKey: "mcpServers" },
  { name: "claude", targetDir: path.join(os.homedir(), ".claude"), mcpConfigPath: path.join(os.homedir(), ".claude.json"), mcpKey: "mcpServers" },
];

export function getPlatform(name: string): Platform | undefined {
  return PLATFORMS.find((p) => p.name === name);
}

/**
 * Resolves platform names to Platform objects, merging built-ins with custom definitions.
 * Custom definitions in cortex.toml take precedence over built-ins of the same name.
 * Warns and skips names that resolve to neither a built-in nor a custom definition.
 */
export function resolvePlatforms(
  names: string[],
  custom?: Record<string, CustomPlatformDef>,
  warn?: (msg: string) => void,
): Platform[] {
  const platforms: Platform[] = [];
  for (const name of names) {
    const customDef = custom?.[name];
    if (customDef) {
      platforms.push({
        name,
        targetDir: path.normalize(customDef.targetDir.replace(/^~/, os.homedir())),
        mcpConfigPath: path.normalize(customDef.mcpConfigPath.replace(/^~/, os.homedir())),
        mcpKey: customDef.mcpKey,
      });
    } else {
      const builtin = getPlatform(name);
      if (!builtin) {
        warn?.(`Unknown platform "${name}" — skipping.`);
        continue;
      }
      platforms.push(builtin);
    }
  }
  return platforms;
}
