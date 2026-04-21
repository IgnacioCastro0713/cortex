import fs from "node:fs/promises";
import path from "node:path";
import { expandPath } from "../utils/fs-utils.ts";
import { DEPS_DIR } from "./constants.ts";
import type { McpServer } from "./parser.ts";
import type { Platform } from "./constants.ts";

export interface McpSyncResult {
  platform: string;
  configPath: string;
  ok: boolean;
  error?: string;
}

/**
 * Resolves @name and ~ in a McpServer's cwd field.
 * args are left as-is (they are not paths in general).
 */
function resolveServer(server: McpServer): McpServer {
  if (!server.cwd) return server;
  const resolved = expandPath(server.cwd, DEPS_DIR);
  return { ...server, cwd: resolved };
}

/**
 * Writes mcpServers to each platform's MCP config file atomically.
 * Preserves all other keys in the existing JSON file.
 */
export async function syncMCP(
  servers: Record<string, McpServer>,
  platforms: Platform[],
  dryRun: boolean,
): Promise<McpSyncResult[]> {
  const resolved: Record<string, McpServer> = {};
  for (const [name, server] of Object.entries(servers)) {
    resolved[name] = resolveServer(server);
  }

  if (dryRun) {
    return platforms.map((platform) => ({ platform: platform.name, configPath: platform.mcpConfigPath, ok: true }));
  }

  return Promise.all(platforms.map(async (platform): Promise<McpSyncResult> => {
    const configPath = platform.mcpConfigPath;
    try {
      // Read existing JSON (if any), preserving all other keys
      let existing: Record<string, unknown> = {};
      try {
        const raw = await fs.readFile(configPath, "utf-8");
        existing = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        // file doesn't exist or is invalid — start fresh
      }

      // Merge: cortex-managed servers are added/updated, existing ones preserved
      const prev = (existing[platform.mcpKey] ?? {}) as Record<string, unknown>;
      existing[platform.mcpKey] = { ...prev, ...resolved };

      const out = JSON.stringify(existing, null, 2) + "\n";

      // Atomic write: write to .tmp then rename
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      const tmp = configPath + ".tmp";
      await fs.writeFile(tmp, out, "utf-8");
      await fs.rename(tmp, configPath);

      return { platform: platform.name, configPath, ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { platform: platform.name, configPath, ok: false, error: msg };
    }
  }));
}

export { displayPath } from "../utils/fs-utils.ts";

/** Removes the given server keys from each platform's MCP config file atomically. */
export async function cleanMCP(
  serverNames: string[],
  platforms: Platform[],
): Promise<McpSyncResult[]> {
  return Promise.all(platforms.map(async (platform): Promise<McpSyncResult> => {
    const configPath = platform.mcpConfigPath;
    try {
      let existing: Record<string, unknown> = {};
      try {
        const raw = await fs.readFile(configPath, "utf-8");
        existing = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return { platform: platform.name, configPath, ok: true };
      }

      const servers = (existing[platform.mcpKey] ?? {}) as Record<string, unknown>;
      for (const name of serverNames) {
        delete servers[name];
      }
      existing[platform.mcpKey] = servers;

      const out = JSON.stringify(existing, null, 2) + "\n";
      const tmp = configPath + ".tmp";
      await fs.writeFile(tmp, out, "utf-8");
      await fs.rename(tmp, configPath);

      return { platform: platform.name, configPath, ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { platform: platform.name, configPath, ok: false, error: msg };
    }
  }));
}
