import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { syncMCP, cleanMCP } from "../../src/core/mcp.ts";
import type { Platform } from "../../src/core/constants.ts";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-mcp-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true });
});

function makePlatform(name: string): Platform {
  return {
    name,
    targetDir: path.join(tmpDir, name),
    mcpConfigPath: path.join(tmpDir, name, "mcp.json"),
    mcpKey: "mcpServers",
  };
}

async function readConfig(platform: Platform): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(platform.mcpConfigPath, "utf-8")) as Record<string, unknown>;
}

describe("syncMCP", () => {
  it("writes servers to platform config", async () => {
    const platform = makePlatform("test");
    const servers = { playwright: { command: "npx", args: ["@playwright/mcp@latest"] } };

    const results = await syncMCP(servers, [platform], false);

    assert.equal(results.length, 1);
    assert.equal(results[0]!.ok, true);
    const written = await readConfig(platform);
    assert.deepEqual((written.mcpServers as Record<string, unknown>).playwright, servers.playwright);
  });

  it("preserves existing non-cortex keys", async () => {
    const platform = makePlatform("test");
    await fs.mkdir(path.dirname(platform.mcpConfigPath), { recursive: true });
    await fs.writeFile(platform.mcpConfigPath, JSON.stringify({
      someOtherKey: "value",
      mcpServers: { existing: { command: "node" } },
    }));

    const results = await syncMCP({ newserver: { command: "npx" } }, [platform], false);
    assert.equal(results[0]!.ok, true);

    const written = await readConfig(platform);
    assert.equal(written.someOtherKey, "value");
    const servers = written.mcpServers as Record<string, unknown>;
    assert.ok(servers.existing, "pre-existing server should be preserved");
    assert.ok(servers.newserver, "new server should be added");
  });

  it("creates config file and parent dirs if they do not exist", async () => {
    const platform = makePlatform("nested/test");
    const servers = { s: { command: "node", args: ["server.js"] } };

    await syncMCP(servers, [platform], false);

    const exists = await fs.access(platform.mcpConfigPath).then(() => true).catch(() => false);
    assert.ok(exists);
  });

  it("dryRun returns ok without writing any file", async () => {
    const platform = makePlatform("test");

    const results = await syncMCP({ s: { command: "x" } }, [platform], true);

    assert.equal(results[0]!.ok, true);
    const exists = await fs.access(platform.mcpConfigPath).then(() => true).catch(() => false);
    assert.equal(exists, false);
  });

  it("handles invalid existing JSON by starting fresh", async () => {
    const platform = makePlatform("test");
    await fs.mkdir(path.dirname(platform.mcpConfigPath), { recursive: true });
    await fs.writeFile(platform.mcpConfigPath, "not valid json {{");

    const results = await syncMCP({ s: { command: "node" } }, [platform], false);

    assert.equal(results[0]!.ok, true);
    const written = await readConfig(platform);
    assert.ok((written.mcpServers as Record<string, unknown>).s);
  });

  it("syncs to multiple platforms independently", async () => {
    const p1 = makePlatform("p1");
    const p2 = makePlatform("p2");
    const servers = { s: { command: "node" } };

    const results = await syncMCP(servers, [p1, p2], false);

    assert.equal(results.length, 2);
    assert.ok(results.every((r) => r.ok));
    const w1 = await readConfig(p1);
    const w2 = await readConfig(p2);
    assert.ok((w1.mcpServers as Record<string, unknown>).s);
    assert.ok((w2.mcpServers as Record<string, unknown>).s);
  });

  it("writes valid JSON with trailing newline", async () => {
    const platform = makePlatform("test");
    await syncMCP({ s: { command: "node" } }, [platform], false);
    const raw = await fs.readFile(platform.mcpConfigPath, "utf-8");
    assert.ok(raw.endsWith("\n"), "output should end with newline");
    assert.doesNotThrow(() => JSON.parse(raw));
  });
});

describe("cleanMCP", () => {
  it("removes specified server keys", async () => {
    const platform = makePlatform("test");
    await fs.mkdir(path.dirname(platform.mcpConfigPath), { recursive: true });
    await fs.writeFile(platform.mcpConfigPath, JSON.stringify({
      mcpServers: { a: { command: "x" }, b: { command: "y" }, c: { command: "z" } },
    }));

    await cleanMCP(["a", "c"], [platform]);

    const written = await readConfig(platform);
    const servers = written.mcpServers as Record<string, unknown>;
    assert.equal(servers.a, undefined);
    assert.equal(servers.c, undefined);
    assert.ok(servers.b, "unrelated server b should remain");
  });

  it("returns ok when config file does not exist", async () => {
    const platform = makePlatform("test");
    const results = await cleanMCP(["s"], [platform]);
    assert.equal(results[0]!.ok, true);
  });

  it("preserves non-mcpServers keys when removing", async () => {
    const platform = makePlatform("test");
    await fs.mkdir(path.dirname(platform.mcpConfigPath), { recursive: true });
    await fs.writeFile(platform.mcpConfigPath, JSON.stringify({
      otherKey: "preserved",
      mcpServers: { s: { command: "node" } },
    }));

    await cleanMCP(["s"], [platform]);

    const written = await readConfig(platform);
    assert.equal(written.otherKey, "preserved");
  });

  it("handles empty serverNames list without modifying existing servers", async () => {
    const platform = makePlatform("test");
    await fs.mkdir(path.dirname(platform.mcpConfigPath), { recursive: true });
    const initial = { mcpServers: { s: { command: "node" } } };
    await fs.writeFile(platform.mcpConfigPath, JSON.stringify(initial));

    const results = await cleanMCP([], [platform]);

    assert.equal(results[0]!.ok, true);
    const written = await readConfig(platform);
    assert.ok((written.mcpServers as Record<string, unknown>).s, "server should remain unchanged");
  });

  it("cleans multiple platforms independently", async () => {
    const p1 = makePlatform("p1");
    const p2 = makePlatform("p2");
    for (const p of [p1, p2]) {
      await fs.mkdir(path.dirname(p.mcpConfigPath), { recursive: true });
      await fs.writeFile(p.mcpConfigPath, JSON.stringify({ mcpServers: { s: { command: "node" } } }));
    }

    const results = await cleanMCP(["s"], [p1, p2]);

    assert.ok(results.every((r) => r.ok));
    for (const p of [p1, p2]) {
      const written = await readConfig(p);
      assert.equal((written.mcpServers as Record<string, unknown>).s, undefined);
    }
  });
});

describe("resolveServer (via syncMCP)", () => {
  it("expands ~ in cwd field", async () => {
    const platform = makePlatform("test");
    await syncMCP({ s: { command: "node", cwd: "~/myproject" } }, [platform], false);
    const written = await readConfig(platform);
    const server = (written.mcpServers as Record<string, unknown>).s as Record<string, unknown>;
    assert.equal(server.cwd, path.join(os.homedir(), "myproject"));
  });

  it("leaves args unchanged", async () => {
    const platform = makePlatform("test");
    const args = ["@playwright/mcp@latest", "--flag"];
    await syncMCP({ s: { command: "npx", args } }, [platform], false);
    const written = await readConfig(platform);
    const server = (written.mcpServers as Record<string, unknown>).s as Record<string, unknown>;
    assert.deepEqual(server.args, args);
  });

  it("leaves server without cwd field unchanged", async () => {
    const platform = makePlatform("test");
    await syncMCP({ s: { command: "node" } }, [platform], false);
    const written = await readConfig(platform);
    const server = (written.mcpServers as Record<string, unknown>).s as Record<string, unknown>;
    assert.equal(server.cwd, undefined);
  });
});
