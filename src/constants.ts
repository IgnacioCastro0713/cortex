import path from "node:path";
import os from "node:os";

export const CORTEX_DIR = path.join(os.homedir(), ".cortex");
export const AI_DIR = path.join(CORTEX_DIR, "ai");
export const DEPS_DIR = path.join(CORTEX_DIR, "deps");

export const PLATFORM_TARGETS: Record<string, string> = {
  copilot: ".github",
  gemini: ".gemini",
};
