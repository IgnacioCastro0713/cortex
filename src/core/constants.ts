import path from "node:path";
import os from "node:os";

export const CORTEX_DIR = path.join(os.homedir(), ".cortex");
export const AI_DIR = path.join(CORTEX_DIR, "ai");
export const DEPS_DIR = path.join(CORTEX_DIR, "deps");

export interface Platform {
  name: string;
  targetDir: string;
  mcpConfigFile: string;
  mcpKey: string;
}

export const PLATFORMS: Platform[] = [
  { name: "copilot", targetDir: path.join(os.homedir(), ".copilot"), mcpConfigFile: "mcp-config.json", mcpKey: "mcpServers" },
  { name: "gemini", targetDir: path.join(os.homedir(), ".gemini"), mcpConfigFile: "settings.json", mcpKey: "mcpServers" },
];

export function getPlatform(name: string): Platform | undefined {
  return PLATFORMS.find((p) => p.name === name);
}
