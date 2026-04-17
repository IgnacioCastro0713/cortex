/**
 * Renders a list of forward-slash-delimited file paths as a tree string.
 *
 * renderTree("skills", ["foo.md", "bar/baz.md", "bar/qux.md"])
 * →
 *   skills/
 *   ├── foo.md
 *   └── bar/
 *       ├── baz.md
 *       └── qux.md
 */
export function renderTree(sectionName: string, fileNames: string[]): string {
  // Build a nested directory structure
  type Dir = { files: string[]; dirs: Map<string, Dir> };

  function makeDir(): Dir {
    return { files: [], dirs: new Map() };
  }

  const root = makeDir();

  for (const fileName of fileNames) {
    const parts = fileName.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i]!;
      if (!node.dirs.has(seg)) node.dirs.set(seg, makeDir());
      node = node.dirs.get(seg)!;
    }
    node.files.push(parts[parts.length - 1]!);
  }

  const lines: string[] = [`${sectionName}/`];

  function walk(node: Dir, prefix: string): void {
    const children: Array<{ label: string; isDir: boolean; dir?: Dir }> = [
      ...node.files.map((f) => ({ label: f, isDir: false })),
      ...[...node.dirs.entries()].map(([name, dir]) => ({ label: name, isDir: true, dir })),
    ];

    for (let i = 0; i < children.length; i++) {
      const last = i === children.length - 1;
      const branch = last ? "└── " : "├── ";
      const child = children[i]!;

      if (child.isDir) {
        lines.push(`${prefix}${branch}${child.label}/`);
        walk(child.dir!, prefix + (last ? "    " : "│   "));
      } else {
        lines.push(`${prefix}${branch}${child.label}`);
      }
    }
  }

  walk(root, "");
  return lines.join("\n");
}
