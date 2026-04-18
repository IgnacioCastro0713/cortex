import path from "node:path";
import os from "node:os";

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
  { name: "copilot", targetDir: ".github", mcpConfigPath: path.join(os.homedir(), ".copilot", "mcp-config.json"), mcpKey: "mcpServers" },
  { name: "gemini", targetDir: ".gemini", mcpConfigPath: path.join(os.homedir(), ".gemini", "settings.json"), mcpKey: "mcpServers" },
];

export function getPlatform(name: string): Platform | undefined {
  return PLATFORMS.find((p) => p.name === name);
}
