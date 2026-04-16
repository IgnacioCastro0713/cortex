import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
const srcUrl = (file: string) => pathToFileURL(path.join(srcDir, file)).href;

type Entry = { source: string; fileName: string };

const readConfigOrExitMock = mock.fn<() => Promise<unknown>>();
const resolveEntriesMock = mock.fn<(patterns: string[], cwd: string) => Promise<Entry[]>>();
const cleanSymlinksMock = mock.fn<(dir: string) => Promise<number>>(async () => 0);
const createSymlinkMock = mock.fn<(target: string, linkPath: string) => Promise<void>>(async () => {});
const logMock = {
  plain: mock.fn(),
  success: mock.fn(),
  warn: mock.fn(),
  error: mock.fn(),
  info: mock.fn(),
  dim: mock.fn(),
};

mock.module(srcUrl("resolver.ts"), {
  namedExports: {
    readConfigOrExit: readConfigOrExitMock,
    resolveEntries: resolveEntriesMock,
    deduplicateEntries: (entries: Entry[]) => entries,
    getSections: (config: { skills: { paths: string[] }; agents: { paths: string[] } }) => [
      { name: "skills", paths: config.skills.paths },
      { name: "agents", paths: config.agents.paths },
    ],
  },
});

mock.module(srcUrl("fs-utils.ts"), {
  namedExports: {
    createSymlink: createSymlinkMock,
    cleanSymlinks: cleanSymlinksMock,
  },
});

mock.module(srcUrl("log.ts"), { namedExports: { log: logMock } });
mock.module(srcUrl("constants.ts"), {
  namedExports: { PLATFORM_TARGETS: { copilot: ".github", gemini: ".gemini" } },
});

const { sync } = await import("../../src/commands/sync.ts");

const CWD = path.normalize("/tmp/project");

beforeEach(() => {
  for (const fn of [readConfigOrExitMock, resolveEntriesMock, cleanSymlinksMock, createSymlinkMock]) {
    fn.mock.resetCalls();
  }
  for (const fn of Object.values(logMock)) fn.mock.resetCalls();
});

describe("sync", () => {
  it("warns when no platforms configured", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: [],
      deps: {},
      skills: { paths: [] },
      agents: { paths: [] },
    }));

    await sync(CWD);

    assert.ok(logMock.warn.mock.calls.some((c) => String(c.arguments[0]).includes("No platforms")));
    assert.equal(createSymlinkMock.mock.callCount(), 0);
  });

  it("skips unknown platforms", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["unknown-ai"],
      deps: {},
      skills: { paths: ["some/*"] },
      agents: { paths: [] },
    }));

    await sync(CWD);

    assert.ok(logMock.warn.mock.calls.some((c) => String(c.arguments[0]).includes("Unknown platform")));
  });

  it("cleans old symlinks then creates new ones", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: ["~/.cortex/ai/skills/*"] },
      agents: { paths: [] },
    }));
    cleanSymlinksMock.mock.mockImplementation(async () => 2);
    resolveEntriesMock.mock.mockImplementation(async (patterns, _cwd) => {
      if (patterns.length === 0) return [];
      return [{ source: "/home/user/.cortex/ai/skills/planning.md", fileName: "planning.md" }];
    });

    await sync(CWD);

    assert.ok(cleanSymlinksMock.mock.callCount() >= 1);
    assert.equal(createSymlinkMock.mock.callCount(), 1);
    const args = createSymlinkMock.mock.calls[0]!.arguments;
    assert.equal(args[0], "/home/user/.cortex/ai/skills/planning.md");
  });

  it("does not create symlinks or clean in dry-run mode", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: ["~/.cortex/ai/skills/*"] },
      agents: { paths: [] },
    }));
    resolveEntriesMock.mock.mockImplementation(async (_patterns, _cwd) => [
      { source: "/home/user/.cortex/ai/skills/planning.md", fileName: "planning.md" },
    ]);

    await sync(CWD, { dryRun: true });

    assert.equal(createSymlinkMock.mock.callCount(), 0);
    assert.equal(cleanSymlinksMock.mock.callCount(), 0);
    assert.ok(logMock.info.mock.calls.some((c) => String(c.arguments[0]).includes("[dry-run]")));
  });

  it("reports failed symlinks", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: ["path/*"] },
      agents: { paths: [] },
    }));
    resolveEntriesMock.mock.mockImplementation(async (_patterns, _cwd) => [
      { source: "/some/source.md", fileName: "source.md" },
    ]);
    createSymlinkMock.mock.mockImplementation(async (_target, _link) => { throw new Error("EPERM"); });

    await sync(CWD);

    assert.ok(logMock.error.mock.calls.some((c) => String(c.arguments[0]).includes("Failed")));
  });
});
