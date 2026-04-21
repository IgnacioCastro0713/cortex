import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
const srcUrl = (file: string) => pathToFileURL(path.join(srcDir, file)).href;

type Entry = { source: string; fileName: string };

const readConfigOrExitMock = mock.fn<() => Promise<unknown>>();
const resolveEntriesMock = mock.fn<(patterns: string[]) => Promise<Entry[]>>();
const copyFileAtomicMock = mock.fn<(src: string, dest: string) => Promise<Buffer>>(async () => Buffer.from("content"));
const removeFileMock = mock.fn(async () => {});
const removeEmptyDirsMock = mock.fn(async () => {});
const listMdFilesMock = mock.fn(async () => [] as string[]);
const loadHashDBMock = mock.fn(async () => ({} as Record<string, string>));
const saveHashDBMock = mock.fn(async () => {});
const isDirtyMock = mock.fn(async () => false);

const fileExistsMock = mock.fn(async () => false);
const logMock = {
  plain: mock.fn(),
  success: mock.fn(),
  warn: mock.fn(),
  error: mock.fn(),
  info: mock.fn(),
  dim: mock.fn(),
  verbose: mock.fn(),
  header: mock.fn(),
  separator: mock.fn(),
  outro: mock.fn(),
};

mock.module(srcUrl("core/resolver.ts"), {
  namedExports: {
    readConfigOrExit: readConfigOrExitMock,
    resolveEntries: resolveEntriesMock,
    deduplicateEntries: (entries: Entry[]) => entries,
    expandEntries: (entries: Entry[]) => Promise.resolve(entries),
    getSections: (config: { skills: { paths: string[] }; agents: { paths: string[] } }) => [
      { name: "skills", paths: config.skills.paths },
      { name: "agents", paths: config.agents.paths },
    ],
  },
});

mock.module(srcUrl("utils/fs-utils.ts"), {
  namedExports: { copyFileAtomic: copyFileAtomicMock, removeFile: removeFileMock, removeEmptyDirs: removeEmptyDirsMock, listMdFiles: listMdFilesMock, fileExists: fileExistsMock, displayPath: (p: string) => p },
});

mock.module(srcUrl("core/hash-db.ts"), {
  namedExports: {
    loadHashDB: loadHashDBMock,
    saveHashDB: saveHashDBMock,
    isDirty: isDirtyMock,
    normalizeKey: (p: string) => p.replace(/\\/g, "/"),
    md5: () => "abc123",
  },
});

mock.module(srcUrl("utils/log.ts"), { namedExports: { log: logMock } });
mock.module(srcUrl("utils/tree.ts"), { namedExports: { renderTree: (section: string, files: string[]) => `${section}/\n${files.join("\n")}` } });
mock.module(srcUrl("core/mcp.ts"), {
  namedExports: {
    syncMCP: mock.fn(async () => []),
    displayPath: (p: string) => p,
  },
});
const mockPlatformMap: Record<string, { name: string; targetDir: string; mcpConfigPath: string; mcpKey: string }> = {
  copilot: { name: "copilot", targetDir: "/mock/home/.github", mcpConfigPath: "/mock/home/.github/mcp.json", mcpKey: "mcpServers" },
  gemini:  { name: "gemini",  targetDir: "/mock/home/.gemini", mcpConfigPath: "/mock/home/.gemini/settings.json", mcpKey: "mcpServers" },
};

mock.module(srcUrl("core/constants.ts"), {
  namedExports: {
    CORTEX_DIR: "/mock/.cortex",
    AI_DIR: "/mock/.cortex/ai",
    DEPS_DIR: "/mock/.cortex/deps",
    PLATFORMS: Object.values(mockPlatformMap),
    getPlatform: (name: string) => mockPlatformMap[name],
    resolvePlatforms: (names: string[], _custom?: unknown, warn?: (msg: string) => void) =>
      names.map((n) => {
        const p = mockPlatformMap[n];
        if (!p) { warn?.(`Unknown platform "${n}" — skipping.`); return undefined; }
        return p;
      }).filter(Boolean),
  },
});

const { sync } = await import("../../src/commands/sync.ts");

beforeEach(() => {
  for (const fn of [readConfigOrExitMock, resolveEntriesMock, copyFileAtomicMock, removeFileMock, removeEmptyDirsMock, saveHashDBMock, listMdFilesMock, isDirtyMock, fileExistsMock]) {
    fn.mock.resetCalls();
  }
  isDirtyMock.mock.mockImplementation(async () => false);
  fileExistsMock.mock.mockImplementation(async () => false);
  loadHashDBMock.mock.resetCalls();
  loadHashDBMock.mock.mockImplementation(async () => ({}));
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

    await sync();

    assert.ok(logMock.warn.mock.calls.some((c) => String(c.arguments[0]).includes("No platforms")));
    assert.equal(copyFileAtomicMock.mock.callCount(), 0);
  });

  it("skips unknown platforms", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["unknown-ai"],
      deps: {},
      skills: { paths: ["some/*"] },
      agents: { paths: [] },
    }));

    await sync();

    assert.ok(logMock.warn.mock.calls.some((c) => String(c.arguments[0]).includes("Unknown platform")));
  });

  it("copies files and saves hash DB", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: ["~/.cortex/ai/skills/*"] },
      agents: { paths: [] },
    }));
    resolveEntriesMock.mock.mockImplementation(async (patterns) => {
      if (patterns.length === 0) return [];
      return [{ source: "/home/user/.cortex/ai/skills/planning.md", fileName: "planning.md" }];
    });

    await sync();

    assert.equal(copyFileAtomicMock.mock.callCount(), 1);
    const args = copyFileAtomicMock.mock.calls[0]!.arguments;
    assert.equal(args[0], "/home/user/.cortex/ai/skills/planning.md");
    assert.equal(saveHashDBMock.mock.callCount(), 1);
  });

  it("does not copy files in dry-run mode", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: ["~/.cortex/ai/skills/*"] },
      agents: { paths: [] },
    }));
    resolveEntriesMock.mock.mockImplementation(async (_patterns) => [
      { source: "/home/user/.cortex/ai/skills/planning.md", fileName: "planning.md" },
    ]);

    await sync({ dryRun: true });

    assert.equal(copyFileAtomicMock.mock.callCount(), 0);
    assert.equal(saveHashDBMock.mock.callCount(), 0);
    assert.ok(logMock.warn.mock.calls.some((c) => String(c.arguments[0]).includes("dry-run")));
  });

  it("reports failed copies", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: ["path/*"] },
      agents: { paths: [] },
    }));
    resolveEntriesMock.mock.mockImplementation(async (_patterns) => [
      { source: "/some/source.md", fileName: "source.md" },
    ]);
    copyFileAtomicMock.mock.mockImplementation(async (_src, _dest) => { throw new Error("EPERM"); });

    await sync();

    // copyFileAtomic was attempted but threw; sync should still complete and save the hash DB
    assert.ok(copyFileAtomicMock.mock.callCount() > 0);
    assert.equal(saveHashDBMock.mock.callCount(), 1);
  });

  it("skips dirty files without --force", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: ["path/*"] },
      agents: { paths: [] },
    }));
    resolveEntriesMock.mock.mockImplementation(async (patterns) => {
      if (patterns.length === 0) return [];
      return [{ source: "/some/source.md", fileName: "source.md" }];
    });
    isDirtyMock.mock.mockImplementation(async () => true);

    await sync();

    assert.equal(copyFileAtomicMock.mock.callCount(), 0);
  });

  it("overwrites dirty files with --force", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: ["path/*"] },
      agents: { paths: [] },
    }));
    resolveEntriesMock.mock.mockImplementation(async (patterns) => {
      if (patterns.length === 0) return [];
      return [{ source: "/some/source.md", fileName: "source.md" }];
    });
    isDirtyMock.mock.mockImplementation(async () => true);

    await sync({ force: true });

    assert.equal(copyFileAtomicMock.mock.callCount(), 1);
  });

  it("copies clean files normally", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: ["path/*"] },
      agents: { paths: [] },
    }));
    resolveEntriesMock.mock.mockImplementation(async (patterns) => {
      if (patterns.length === 0) return [];
      return [{ source: "/some/source.md", fileName: "source.md" }];
    });
    isDirtyMock.mock.mockImplementation(async () => false);

    await sync();

    assert.equal(copyFileAtomicMock.mock.callCount(), 1);
  });

  it("skips unmanaged files without --force", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: ["path/*"] },
      agents: { paths: [] },
    }));
    resolveEntriesMock.mock.mockImplementation(async (patterns) => {
      if (patterns.length === 0) return [];
      return [{ source: "/some/source.md", fileName: "source.md" }];
    });
    fileExistsMock.mock.mockImplementation(async () => true); // dest exists but not in hashDB

    await sync();

    assert.equal(copyFileAtomicMock.mock.callCount(), 0);
  });

  it("overwrites unmanaged files with --force", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: ["path/*"] },
      agents: { paths: [] },
    }));
    resolveEntriesMock.mock.mockImplementation(async (patterns) => {
      if (patterns.length === 0) return [];
      return [{ source: "/some/source.md", fileName: "source.md" }];
    });
    fileExistsMock.mock.mockImplementation(async () => true);

    await sync({ force: true });

    assert.equal(copyFileAtomicMock.mock.callCount(), 1);
  });
});
