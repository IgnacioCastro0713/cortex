import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
const srcUrl = (file: string) => pathToFileURL(path.join(srcDir, file)).href;

const ensureDirMock = mock.fn<(dir: string) => Promise<void>>(async () => {});
const readConfigMock = mock.fn<() => Promise<unknown>>();
const writeConfigMock = mock.fn(async () => {});
const defaultConfigMock = mock.fn(() => ({
  platforms: ["copilot"],
  deps: {},
  skills: { paths: [] },
  agents: { paths: [] },
}));
const getConfigPathMock = mock.fn(() => "/home/user/.cortex/cortex.toml");
const logMock = {
  plain: mock.fn(),
  success: mock.fn(),
  warn: mock.fn(),
  error: mock.fn(),
  info: mock.fn(),
  dim: mock.fn(),
};

mock.module(srcUrl("fs-utils.ts"), {
  namedExports: { ensureDir: ensureDirMock },
});

mock.module(srcUrl("parser.ts"), {
  namedExports: {
    readConfig: readConfigMock,
    writeConfig: writeConfigMock,
    defaultConfig: defaultConfigMock,
    getConfigPath: getConfigPathMock,
  },
});

mock.module(srcUrl("log.ts"), {
  namedExports: { log: logMock },
});

mock.module(srcUrl("constants.ts"), {
  namedExports: {
    CORTEX_DIR: "/home/user/.cortex",
    AI_DIR: "/home/user/.cortex/ai",
    DEPS_DIR: "/home/user/.cortex/deps",
  },
});

const { init } = await import("../../src/commands/init.ts");

beforeEach(() => {
  ensureDirMock.mock.resetCalls();
  readConfigMock.mock.resetCalls();
  writeConfigMock.mock.resetCalls();
  logMock.success.mock.resetCalls();
  logMock.info.mock.resetCalls();
});

describe("init", () => {
  it("creates agent, skill, and deps directories", async () => {
    readConfigMock.mock.mockImplementation(async () => ({ platforms: [], deps: {}, skills: { paths: [] }, agents: { paths: [] } }));

    await init();

    assert.equal(ensureDirMock.mock.callCount(), 3);
    const paths = ensureDirMock.mock.calls.map((c) => c.arguments[0]);
    assert.ok(paths.some((p: string) => p.includes("agents")));
    assert.ok(paths.some((p: string) => p.includes("skills")));
    assert.ok(paths.some((p: string) => p.includes("deps")));
  });

  it("skips writing config when it already exists", async () => {
    readConfigMock.mock.mockImplementation(async () => ({ platforms: [], deps: {}, skills: { paths: [] }, agents: { paths: [] } }));

    await init();

    assert.equal(writeConfigMock.mock.callCount(), 0);
    assert.ok(logMock.info.mock.calls.some((c) => String(c.arguments[0]).includes("already exists")));
  });

  it("writes default config when no config exists", async () => {
    readConfigMock.mock.mockImplementation(async () => { throw new Error("ENOENT"); });

    await init();

    assert.equal(writeConfigMock.mock.callCount(), 1);
    assert.equal(defaultConfigMock.mock.callCount(), 1);
  });
});
