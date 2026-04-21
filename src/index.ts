#!/usr/bin/env node

import { parseArgs } from "node:util";
import { createRequire } from "node:module";
import { init } from "./commands/init.ts";
import { update } from "./commands/update.ts";
import { sync } from "./commands/sync.ts";
import { list } from "./commands/list.ts";
import { clean } from "./commands/clean.ts";
import { status } from "./commands/status.ts";
import { setVerbose } from "./utils/log.ts";

const HELP = `
cortex — Knowledge distribution engine

Usage:
  cortex <command> [options]

Commands:
  init     Generate ~/.cortex/cortex.toml and ensure ~/.cortex/ai structure exists
  update   Pull latest changes for ~/.cortex/ai and all deps
  sync     Copy knowledge files and MCP configs into global platform directories
  status   Show sync state of each configured file (synced, modified, new)
  list     Show the map of linked files
  clean    Remove all cortex-managed files from platform directories

Options:
  --dry-run, -d   Preview sync without making changes
  --force, -f     Overwrite locally modified files
  --verbose, -V   Show verbose diagnostic output
  --version, -v   Show version
  --help, -h      Show this help message
`.trim();

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
      "dry-run": { type: "boolean", short: "d", default: false },
      force: { type: "boolean", short: "f", default: false },
      verbose: { type: "boolean", short: "V", default: false },
    },
  });

  if (values.verbose) setVerbose(true);

  if (values.version) {
    const require = createRequire(import.meta.url);
    const pkg = require("../package.json") as { version: string };
    console.log(pkg.version);
    process.exit(0);
  }

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    process.exit(0);
  }

  const command = positionals[0];

  switch (command) {
    case "init":
      await init();
      break;
    case "update":
      await update();
      break;
    case "sync":
      await sync({
        dryRun: values["dry-run"],
        force: values.force,
      });
      break;
    case "status":
      await status();
      break;
    case "list":
      await list();
      break;
    case "clean":
      await clean({ force: values.force });
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(`  ✗  Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
