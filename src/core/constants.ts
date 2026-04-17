import path from "node:path";
import os from "node:os";

export const CORTEX_DIR = path.join(os.homedir(), ".cortex");
export const AI_DIR = path.join(CORTEX_DIR, "ai");
export const DEPS_DIR = path.join(CORTEX_DIR, "deps");

export interface Platform {
  name: string;
  targetDir: string;
}

export const PLATFORMS: Platform[] = [
  { name: "copilot", targetDir: ".github" },
  { name: "gemini", targetDir: ".gemini" },
];

export function getPlatform(name: string): Platform | undefined {
  return PLATFORMS.find((p) => p.name === name);
}
