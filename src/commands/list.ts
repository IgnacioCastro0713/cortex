import fs from "node:fs/promises";
import { log } from "../utils/log.ts";
import { resolveEntries, getSections, readConfigOrExit } from "../core/resolver.ts";
import { renderTree } from "../utils/tree.ts";

export async function list(): Promise<void> {
  log.header("list");

  const config = await readConfigOrExit();
  const sectionLines: string[] = [];
  const counts: { name: string; count: number }[] = [];

  for (const section of getSections(config)) {
    const entries = await resolveEntries(section.paths);
    if (entries.length === 0) continue;

    const fileNames: string[] = [];
    const brokenLines: string[] = [];

    for (const { source, fileName } of entries) {
      const relDest = fileName.replace(/\\/g, "/");
      let broken = false;
      try {
        await fs.access(source);
      } catch {
        broken = true;
      }

      if (broken) {
        brokenLines.push(`⚠ ${relDest} → ${source} (not found)`);
      } else {
        fileNames.push(relDest);
      }
    }

    if (fileNames.length > 0) sectionLines.push(renderTree(section.name, fileNames));
    for (const b of brokenLines) sectionLines.push(b);
    counts.push({ name: section.name, count: entries.length });
  }

  // MCP servers
  const mcpEntries = Object.keys(config.mcp ?? {});
  if (mcpEntries.length > 0) {
    sectionLines.push(renderTree("mcp", mcpEntries));
    counts.push({ name: "mcp", count: mcpEntries.length });
  }

  if (counts.length === 0) {
    console.log();
    log.outro("No files resolved — run `cortex sync` after configuring cortex.toml.");
  } else {
    log.dim(sectionLines.join("\n\n"));
    console.log();
    const summary = counts.map(({ name, count }) => `${count} ${count === 1 ? name.replace(/s$/, "") : name}`).join("  ·  ");
    log.success(summary);
  }
}
